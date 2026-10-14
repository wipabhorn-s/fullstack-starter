import { AuthService } from '@/auth/auth.service';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

const activeUser = {
  id: 'user-1',
  email: 'ann@example.com',
  name: 'Ann',
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-01-01'),
  sessionVersion: 3,
};

function setup() {
  const usersService = {
    create: jest.fn().mockResolvedValue(activeUser),
    findById: jest.fn().mockResolvedValue(activeUser),
    findByEmailWithPassword: jest.fn(),
    findByGoogleId: jest.fn(),
    upsertGoogleUser: jest.fn(),
  };
  const bcrypt = {
    hash: jest.fn().mockResolvedValue('dummy-hash'),
    compare: jest.fn(),
  };
  const accessToken = { sign: jest.fn().mockResolvedValue('access') };
  const refreshToken = {
    issue: jest.fn().mockResolvedValue('refresh'),
    rotate: jest
      .fn()
      .mockResolvedValue({ userId: 'user-1', refreshToken: 'refresh-2' }),
    revoke: jest.fn(),
  };
  const google = { verify: jest.fn() };
  const mail = { sendWelcome: jest.fn().mockResolvedValue(undefined) };

  const service = new AuthService(
    usersService as never,
    bcrypt as never,
    accessToken as never,
    refreshToken as never,
    google as never,
    mail as never,
  );
  return {
    service,
    usersService,
    bcrypt,
    accessToken,
    refreshToken,
    google,
    mail,
  };
}

describe('AuthService', () => {
  describe('register', () => {
    it('สร้างบัญชี ส่งเมลต้อนรับ และคืน session โดยไม่มี sessionVersion', async () => {
      const { service, mail } = setup();

      const result = await service.register({
        name: 'Ann',
        email: 'ann@example.com',
        password: 'Passw0rd!',
      });

      expect(mail.sendWelcome).toHaveBeenCalledWith('ann@example.com', 'Ann');
      expect(result).toMatchObject({
        access_token: 'access',
        refresh_token: 'refresh',
        user: { id: 'user-1' },
      });
      expect(result.user).not.toHaveProperty('sessionVersion');
    });

    it('เมลส่งไม่ออกก็ยังสมัครสำเร็จ', async () => {
      const { service, mail } = setup();
      mail.sendWelcome.mockRejectedValue(new Error('Brevo down'));
      jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      await expect(
        service.register({ name: 'Ann', email: 'a@b.co', password: 'x' }),
      ).resolves.toMatchObject({ access_token: 'access' });
    });
  });

  describe('login', () => {
    it('ไม่มีบัญชี: ยังเทียบ bcrypt กับ hash หลอก (เวลาตอบเท่ากัน) แล้วตอบ 401', async () => {
      const { service, usersService, bcrypt } = setup();
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'x@example.com', password: 'p' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).toHaveBeenCalledWith('p', 'dummy-hash');
    });

    it('บัญชี Google ที่ไม่มีรหัสผ่าน ตอบเหมือนรหัสผิด', async () => {
      const { service, usersService, bcrypt } = setup();
      usersService.findByEmailWithPassword.mockResolvedValue({
        ...activeUser,
        password: null,
      });
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        service.login({ email: activeUser.email, password: 'p' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('บัญชีถูกระงับ: บอกสาเหตุหลังรหัสผ่านถูกแล้วเท่านั้น', async () => {
      const { service, usersService, bcrypt } = setup();
      usersService.findByEmailWithPassword.mockResolvedValue({
        ...activeUser,
        status: 'SUSPENDED',
        password: 'hash',
      });
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        service.login({ email: activeUser.email, password: 'p' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('สำเร็จ: access token พก sessionVersion ปัจจุบัน (ver)', async () => {
      const { service, usersService, bcrypt, accessToken } = setup();
      usersService.findByEmailWithPassword.mockResolvedValue({
        ...activeUser,
        password: 'hash',
      });
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.login({
        email: activeUser.email,
        password: 'p',
      });

      expect(accessToken.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', ver: 3 }),
      );
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('loginWithGoogle', () => {
    it('ไม่เคยผูก Google: ผูก/สร้างบัญชีจากโปรไฟล์ที่ Google ยืนยันแล้ว', async () => {
      const { service, usersService, google } = setup();
      const profile = {
        googleId: 'g-1',
        email: 'ann@example.com',
        name: 'Ann',
      };
      google.verify.mockResolvedValue(profile);
      usersService.findByGoogleId.mockResolvedValue(null);
      usersService.upsertGoogleUser.mockResolvedValue(activeUser);

      await expect(
        service.loginWithGoogle({ idToken: 't' }),
      ).resolves.toMatchObject({ access_token: 'access' });
      expect(usersService.upsertGoogleUser).toHaveBeenCalledWith(profile);
    });
  });

  describe('refresh', () => {
    it('บัญชีถูกระงับระหว่างที่ล็อกอินอยู่: ทิ้ง refresh token ใบใหม่ด้วย', async () => {
      const { service, usersService, refreshToken } = setup();
      usersService.findById.mockResolvedValue({
        ...activeUser,
        status: 'SUSPENDED',
      });

      await expect(
        service.refresh({ refreshToken: 'refresh' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(refreshToken.revoke).toHaveBeenCalledWith('refresh-2');
    });

    it('บัญชีถูกลบ: 401 SESSION_INVALID', async () => {
      const { service, usersService } = setup();
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'refresh' }),
      ).rejects.toMatchObject({ response: { code: 'SESSION_INVALID' } });
    });
  });
});
