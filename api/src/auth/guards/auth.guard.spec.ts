import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TokenExpiredError } from '@nestjs/jwt';

import { AuthGuard } from './auth.guard';

const USER_ID = '0199a0e0-0000-7000-8000-000000000001';

function contextWith(authorization?: string) {
  const request: Record<string, unknown> = {
    headers: authorization ? { authorization } : {},
  };
  return {
    request,
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    },
  };
}

describe('AuthGuard', () => {
  let accessToken: { verify: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: { user: { findFirst: jest.Mock } };
  let guard: AuthGuard;

  beforeEach(() => {
    accessToken = {
      verify: jest
        .fn()
        .mockResolvedValue({ sub: USER_ID, role: 'USER', ver: 0 }),
    };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ status: 'ACTIVE', sessionVersion: 0 }),
      },
    };
    guard = new AuthGuard(
      accessToken as never,
      reflector as never,
      prisma as never,
    );
  });

  it('ปล่อยผ่าน route ที่เป็น @Public() โดยไม่แตะ DB เลย', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx } = contextWith();

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('ปฏิเสธเมื่อไม่มี Authorization header', async () => {
    const { ctx } = contextWith();

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('ปฏิเสธเมื่อ token หมดอายุ', async () => {
    accessToken.verify.mockRejectedValue(
      new TokenExpiredError('jwt expired', new Date()),
    );
    const { ctx } = contextWith('Bearer token');

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('ผ่านและใส่ payload ลง request เมื่อบัญชียังใช้งานได้', async () => {
    const { ctx, request } = contextWith('Bearer token');

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: USER_ID, role: 'USER', ver: 0 });
  });

  // access token เพิกถอนกลางคันไม่ได้ ถ้าไม่เช็กบัญชีที่นี่ คนที่เพิ่งถูก
  // ลบ/ระงับจะยังยิง API ได้จนกว่า token ในมือจะหมดอายุ
  describe('เช็กสถานะบัญชีต่อจากลายเซ็น', () => {
    it('ปฏิเสธ token ของบัญชีที่ถูก soft delete แล้ว (401)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const { ctx } = contextWith('Bearer token');

      await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
        status: 401,
        response: { code: 'SESSION_INVALID' },
      });
    });

    it('ปฏิเสธ token ของบัญชีที่ถูกระงับ (403 ACCOUNT_SUSPENDED)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        status: 'SUSPENDED',
        sessionVersion: 0,
      });
      const { ctx } = contextWith('Bearer token');

      const error = await guard
        .canActivate(ctx as never)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error).toMatchObject({
        response: { code: 'ACCOUNT_SUSPENDED' },
      });
    });

    it('ปฏิเสธ token รุ่นเก่าหลัง sessionVersion เพิ่มขึ้น (ยกเลิกทุก session)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        sessionVersion: 1,
      });
      const { ctx } = contextWith('Bearer token');

      await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
        status: 401,
        response: { code: 'SESSION_INVALID' },
      });
    });

    it('กรอง deletedAt ตั้งแต่ใน query ไม่ใช่มากรองทีหลัง', async () => {
      const { ctx } = contextWith('Bearer token');

      await guard.canActivate(ctx as never);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: USER_ID, deletedAt: null },
        select: { status: true, sessionVersion: true },
      });
    });
  });
});
