import { AppModule } from '@/app.module';
import { AccessTokenService } from '@/auth/access-token.service';
import { PrismaService } from '@/database/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * บูตแอปทั้งตัว (guard ทั้งสามตัว, pipe, env validation) โดยไม่ต้องมีฐานข้อมูลจริง:
 * แทน PrismaService ด้วยของปลอม (env หลอกอยู่ใน test/setup-env.ts)
 */
describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let tokenFor: (role: 'USER' | 'ADMIN') => Promise<string>;

  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ status: 'ACTIVE', sessionVersion: 0 }),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    // ตั้งเหมือน main.ts (main.ts ไม่ถูกเรียกใน test)
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    const accessTokens = app.get(AccessTokenService);
    tokenFor = (role) =>
      accessTokens.sign({ sub: 'user-1', email: 'a@b.co', role, ver: 0 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('routes are protected by default (AuthGuard)', () => {
    return request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('@Roles(ADMIN) rejects a USER token (RolesGuard)', async () => {
    return request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${await tokenFor('USER')}`)
      .expect(403);
  });

  it('a suspended account is rejected even with a valid token', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      status: 'SUSPENDED',
      sessionVersion: 0,
    });

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${await tokenFor('USER')}`)
      .expect(403);
    expect(response.body).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  });

  it('DTO validation rejects a weak password (ValidationPipe)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Ann', email: 'ann@example.com', password: 'weak' })
      .expect(400);
  });
});
