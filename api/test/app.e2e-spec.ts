import { AppModule } from '@/app.module';
import { PrismaService } from '@/database/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * บูตแอปทั้งตัว (guard, pipe, env validation) โดยไม่ต้องมีฐานข้อมูลจริง:
 * แทน PrismaService ด้วยของปลอมที่ตอบ SELECT 1 ได้ (env หลอกอยู่ใน test/setup-env.ts)
 */
describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
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
});
