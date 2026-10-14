import type { Request } from 'express';
import * as crypto from 'node:crypto';
import { isIP } from 'node:net';

/**
 * IP จริงของผู้ใช้ (ใช้นับ rate limit และการใส่รหัสผิด)
 *
 * API ถูกเรียกจาก server ของเว็บ ไม่ใช่เบราว์เซอร์โดยตรง IP ที่ API เห็นจึงเป็น IP ของ server เว็บ
 * เว็บจึงส่ง IP ของผู้ใช้มาใน X-Client-IP พร้อมรหัสลับร่วม (INTERNAL_API_SECRET)
 * - รหัสตรง: เชื่อ X-Client-IP (มาจาก server เว็บของเราจริง)
 * - ไม่มี/ไม่ตรง: ใช้ req.ip (IP ที่ต่อเข้ามาจริง ผ่าน trust proxy ของ hosting)
 *   คนที่ยิง API ตรง ๆ จึงปลอม IP หลบ rate limit ไม่ได้
 *
 * ใช้รหัสลับแทนการระบุ IP ของ server เว็บ เพราะ hosting ส่วนใหญ่ (Render, Vercel ฯลฯ)
 * เปลี่ยน IP ขาออกได้เรื่อย ๆ ระบุตายตัวไม่ได้
 */
export const CLIENT_IP_HEADER = 'x-client-ip';
export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

/** เทียบรหัสลับแบบใช้เวลาเท่ากันเสมอ (กันเดารหัสจากเวลาที่ตอบ) */
function secretMatches(received: string | undefined, expected: string) {
  if (!received) return false;
  const a = crypto.createHash('sha256').update(received).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function resolveClientIp(
  request: Pick<Request, 'ip' | 'headers'>,
  internalSecret: string | undefined,
): string {
  const fallback = request.ip ?? 'unknown';
  if (!internalSecret) return fallback;

  const secret = request.headers[INTERNAL_SECRET_HEADER];
  const forwarded = request.headers[CLIENT_IP_HEADER];
  if (
    typeof secret === 'string' &&
    typeof forwarded === 'string' &&
    secretMatches(secret, internalSecret) &&
    isIP(forwarded.trim()) !== 0
  ) {
    return forwarded.trim();
  }
  return fallback;
}
