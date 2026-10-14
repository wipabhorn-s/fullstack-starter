import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // pnpm db:seed (และ migrate reset) สร้างบัญชีแอดมินคนแรก ดู prisma/seed.ts
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // prisma generate ไม่ได้ต่อ DB จริง ค่าว่างก็ generate ได้ (เช่นใน CI)
    url: process.env['DATABASE_URL'] ?? '',
  },
});
