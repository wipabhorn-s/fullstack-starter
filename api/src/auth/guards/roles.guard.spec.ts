import { IS_PUBLIC_KEY } from '@/common/decorator/public.decorator';
import { ROLES_KEY } from '@/common/decorator/roles.decorator';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function setup(metadata: Record<string, unknown>, user?: { role: string }) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  };
  return { guard: new RolesGuard(reflector as never), ctx: ctx as never };
}

describe('RolesGuard', () => {
  it('ปล่อยผ่าน route ที่ไม่ได้ติด @Roles()', () => {
    const { guard, ctx } = setup({}, { role: 'USER' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ปล่อยผ่าน @Public() แม้ไม่มี user', () => {
    const { guard, ctx } = setup({
      [IS_PUBLIC_KEY]: true,
      [ROLES_KEY]: ['ADMIN'],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ผ่านเมื่อ role ตรง', () => {
    const { guard, ctx } = setup({ [ROLES_KEY]: ['ADMIN'] }, { role: 'ADMIN' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('403 เมื่อ role ไม่ตรง', () => {
    const { guard, ctx } = setup({ [ROLES_KEY]: ['ADMIN'] }, { role: 'USER' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
