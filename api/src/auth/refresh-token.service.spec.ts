import {
  REUSE_GRACE_MS,
  RefreshTokenService,
} from '@/auth/refresh-token.service';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';

/** หมุน refresh token: ใบใหม่ทุกครั้ง, ใช้ซ้ำหลังช่วงผ่อนผัน = ยกเลิกทั้ง family */

const sha256 = (raw: string) =>
  crypto.createHash('sha256').update(raw).digest('hex');

type Row = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

/** ฐานข้อมูลจำลองในหน่วยความจำ พอให้ทดสอบกติกาของ service ได้ครบ */
function setup() {
  const rows: Row[] = [];
  let users: { id: string; sessionVersion: number }[] = [
    { id: 'user-1', sessionVersion: 0 },
  ];
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (value === null) return row[key as keyof Row] === null;
      if (value && typeof value === 'object' && 'lte' in value) {
        return (row[key as keyof Row] as Date) <= (value.lte as Date);
      }
      return row[key as keyof Row] === value;
    });

  const prisma = {
    refreshToken: {
      create: jest.fn(
        ({ data }: { data: Omit<Row, 'id' | 'usedAt' | 'revokedAt'> }) => {
          const row = {
            ...data,
            id: crypto.randomUUID(),
            usedAt: null,
            revokedAt: null,
          };
          rows.push(row);
          return Promise.resolve(row);
        },
      ),
      deleteMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (matches(rows[i], where)) rows.splice(i, 1);
        }
        return Promise.resolve({ count: before - rows.length });
      }),
      findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(
          rows.find((row) => row.tokenHash === where.tokenHash) ?? null,
        ),
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<Row>;
        }) => {
          const hit = rows.filter((row) => matches(row, where));
          hit.forEach((row) => Object.assign(row, data));
          return Promise.resolve({ count: hit.length });
        },
      ),
    },
    user: {
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { sessionVersion: { increment: number } };
        }) => {
          users = users.map((user) =>
            user.id === where.id
              ? {
                  ...user,
                  sessionVersion:
                    user.sessionVersion + data.sessionVersion.increment,
                }
              : user,
          );
          return Promise.resolve(users.find((user) => user.id === where.id));
        },
      ),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const config = { get: jest.fn(() => 30 * 24 * 60 * 60) };
  const service = new RefreshTokenService(prisma as never, config as never);
  return { service, rows, prisma, users: () => users };
}

describe('RefreshTokenService', () => {
  afterEach(() => jest.useRealTimers());

  it('stores only the sha256 hash, never the token itself', async () => {
    const { service, rows } = setup();
    const raw = await service.issue('user-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(sha256(raw));
    expect(JSON.stringify(rows)).not.toContain(raw);
  });

  it('rotates: returns a new token in the same family and retires the old one', async () => {
    const { service, rows } = setup();
    const first = await service.issue('user-1');

    const { userId, refreshToken } = await service.rotate(first);

    expect(userId).toBe('user-1');
    expect(refreshToken).not.toBe(first);
    expect(rows).toHaveLength(2);
    expect(rows[0].usedAt).toBeInstanceOf(Date);
    expect(rows[1].familyId).toBe(rows[0].familyId);
  });

  it('allows the same token again within the grace window (parallel requests)', async () => {
    const { service, rows } = setup();
    const first = await service.issue('user-1');

    await service.rotate(first);
    await expect(service.rotate(first)).resolves.toMatchObject({
      userId: 'user-1',
    });
    expect(rows.every((row) => row.revokedAt === null)).toBe(true);
  });

  it('treats reuse after the grace window as theft and revokes the whole family', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-06T00:00:00Z') });
    const { service, rows } = setup();
    const first = await service.issue('user-1');
    const { refreshToken: second } = await service.rotate(first);

    jest.setSystemTime(Date.now() + REUSE_GRACE_MS + 1_000);

    await expect(service.rotate(first)).rejects.toMatchObject({
      response: { code: 'REFRESH_REUSED' },
    });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    // ใบล่าสุดของเจ้าของจริงก็ใช้ไม่ได้แล้ว ต้องล็อกอินใหม่
    await expect(service.rotate(second)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects unknown, expired and revoked tokens', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-06T00:00:00Z') });
    const { service, rows } = setup();

    await expect(service.rotate('not-a-real-token')).rejects.toMatchObject({
      response: { code: 'REFRESH_INVALID' },
    });

    const expired = await service.issue('user-1');
    rows[0].expiresAt = new Date(Date.now() - 1);
    await expect(service.rotate(expired)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const revoked = await service.issue('user-1');
    await service.revoke(revoked);
    await expect(service.rotate(revoked)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revokes only that device (family)', async () => {
    const { service } = setup();
    const laptop = await service.issue('user-1');
    const phone = await service.issue('user-1');

    await service.revoke(laptop);

    await expect(service.rotate(laptop)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.rotate(phone)).resolves.toMatchObject({
      userId: 'user-1',
    });
  });

  it('revokeAllForUser ends every device and bumps the session version', async () => {
    const { service, users } = setup();
    const laptop = await service.issue('user-1');
    const phone = await service.issue('user-1');

    const version = await service.revokeAllForUser('user-1');

    await expect(service.rotate(laptop)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.rotate(phone)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // access token รุ่นเก่า (ver 0) ใช้ไม่ได้ทันที AuthGuard เทียบกับเลขนี้
    expect(version).toBe(1);
    expect(users()[0].sessionVersion).toBe(1);
  });
});
