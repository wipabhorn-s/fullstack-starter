import { AdminService } from '@/admin/admin.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function setup() {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-2' }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: { status: string } }) =>
          Promise.resolve({ id: 'user-2', status: data.status }),
        ),
    },
  };
  const refreshTokens = { revokeAllRefreshTokens: jest.fn() };
  const service = new AdminService(prisma as never, refreshTokens as never);
  return { service, prisma, refreshTokens };
}

describe('AdminService.updateUserStatus', () => {
  it('ระงับแล้วยกเลิก refresh token ทุกใบ (ต่ออายุ session ไม่ได้อีก)', async () => {
    const { service, refreshTokens } = setup();

    await expect(
      service.updateUserStatus('admin-1', 'user-2', 'SUSPENDED'),
    ).resolves.toMatchObject({ status: 'SUSPENDED' });
    expect(refreshTokens.revokeAllRefreshTokens).toHaveBeenCalledWith('user-2');
  });

  it('ปลดระงับไม่แตะ refresh token', async () => {
    const { service, refreshTokens } = setup();

    await service.updateUserStatus('admin-1', 'user-2', 'ACTIVE');
    expect(refreshTokens.revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('แอดมินเปลี่ยนสถานะตัวเองไม่ได้', async () => {
    const { service } = setup();

    await expect(
      service.updateUserStatus('admin-1', 'admin-1', 'SUSPENDED'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 เมื่อไม่มีบัญชี (หรือถูกลบไปแล้ว)', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.updateUserStatus('admin-1', 'ghost', 'SUSPENDED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
