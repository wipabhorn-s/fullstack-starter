import { Logger } from '@nestjs/common';
import z from 'zod';

/**
 * ค่าที่ไม่ใส่ก็ได้ — และ "ใส่เป็นบรรทัดว่าง" ต้องมีค่าเท่ากับไม่ใส่
 *
 * dotenv อ่านบรรทัด `KEY=` ออกมาเป็นสตริงว่าง ไม่ใช่ undefined ส่วน
 * `.min(1).optional()` เฉย ๆ ยอมรับแค่ undefined คนที่ก๊อป .env.example
 * ไปแล้วกรอกเฉพาะที่ตัวเองใช้จะเจอ "Env validation failed" ทั้งที่ค่านั้นไม่จำเป็น
 */
const optionalString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(8000),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    FRONTEND_URL: z.url(),
    DATABASE_URL: z.url(),
    /**
     * ใครส่ง X-Forwarded-For มาแล้วเชื่อได้ (ค่าแบบ Express "trust proxy")
     * API ถูกเรียกจาก server ของเว็บ IP จริงของผู้ใช้จึงมากับ header นี้
     * ต้องเชื่อเฉพาะ server ของเว็บ ไม่งั้นใครก็ปลอม IP หลบ rate limit ได้
     */
    TRUST_PROXY: z.string().trim().default('loopback'),
    /**
     * รหัสลับร่วมระหว่าง server เว็บกับ API (ค่าเดียวกันทั้งสองฝั่ง)
     * มีรหัสนี้ API จึงเชื่อ IP ของผู้ใช้ที่เว็บส่งมา (X-Client-IP) ดู common/utils/client-ip.ts
     */
    INTERNAL_API_SECRET: z.preprocess(
      (value) =>
        typeof value === 'string' && value.trim() === '' ? undefined : value,
      z.string().trim().min(32).optional(),
    ),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    ACCESS_TOKEN_EXPIRES_IN: z.coerce.number().int().positive().default(900),
    /** อายุ refresh token (วินาที) ไม่ใส่ = 30 วัน */
    REFRESH_TOKEN_EXPIRES_IN: z.coerce
      .number()
      .int()
      .positive()
      .default(30 * 24 * 60 * 60),
    /** ไม่ใส่ = ปิดล็อกอินด้วย Google (POST /auth/google ตอบ 503) */
    GOOGLE_CLIENT_ID: optionalString,
    /** ไม่ใส่ตอน dev = MailService พิมพ์อีเมลลง console แทนการส่งจริง */
    BREVO_API_KEY: optionalString,
    MAIL_FROM: optionalString,
    MAIL_FROM_NAME: z.string().trim().min(1).default('My App'),
  })
  .superRefine((env, ctx) => {
    // production ห้ามตกไปใช้ console เงียบ ๆ: ผู้ใช้จะไม่ได้อีเมลเลยโดยไม่มีใครรู้
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['BREVO_API_KEY', 'MAIL_FROM'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required when NODE_ENV=production',
        });
      }
    }
  });

export function validate(config: Record<string, any>) {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const logger = new Logger('EnvValidation');
    logger.error('Env validation failed', z.prettifyError(parsed.error));
    throw new Error('Env validation failed');
  }
  return parsed.data;
}

export type EnvVariable = z.infer<typeof envSchema>;
