/**
 * สร้าง (หรืออัปเดต) บัญชีแอดมินคนแรก — รันด้วย `pnpm db:seed`
 * (prisma migrate reset ก็เรียกไฟล์นี้ให้เอง ดู prisma.config.ts)
 *
 * รันซ้ำได้: มีอีเมลนี้อยู่แล้ว = ตั้ง role ADMIN + ACTIVE และเปลี่ยนรหัสผ่านเป็นค่าใน env
 * ห้ามใส่รหัสผ่านจริงลงในไฟล์นี้หรือ .env.example — อ่านจาก .env เท่านั้น
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import z from 'zod';
import { STRONG_PASSWORD } from '../src/common/decorator/strong-password.decorator';
import { PrismaClient } from '../src/database/generated/prisma/client';

const env = z
  .object({
    DATABASE_URL: z.url(),
    SEED_ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
    // กฎเดียวกับตอนสมัคร (@StrongPassword) ไม่งั้นแอดมินมีรหัสที่หน้าเว็บไม่ยอมรับ
    SEED_ADMIN_PASSWORD: z
      .string()
      .regex(
        STRONG_PASSWORD,
        '8-72 chars with lowercase, uppercase, number and symbol',
      ),
    SEED_ADMIN_NAME: z.string().trim().min(1).default('Admin'),
  })
  .parse(process.env);

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  try {
    // saltRounds เท่ากับ BcryptService (12)
    const password = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);

    const admin = await prisma.user.upsert({
      where: { email: env.SEED_ADMIN_EMAIL },
      create: {
        email: env.SEED_ADMIN_EMAIL,
        name: env.SEED_ADMIN_NAME,
        password,
        role: 'ADMIN',
      },
      update: { password, role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
      select: { id: true, email: true },
    });

    console.log(`Seeded admin ${admin.email} (${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
