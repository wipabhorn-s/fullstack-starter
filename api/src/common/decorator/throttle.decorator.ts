import { Throttle } from '@nestjs/throttler';

/**
 * จำกัดจำนวนคำขอต่อ IP (นับจาก IP จริงของผู้ใช้ที่เว็บส่งต่อมา ดู TRUST_PROXY)
 * ค่าเริ่มต้นของทุก endpoint อยู่ที่ ThrottlerModule ใน app.module.ts
 */
const MINUTE = 60_000;

/** ค่าเริ่มต้นทุก endpoint: กันยิงถล่ม (หน้าเว็บปกติใช้ไม่ถึง) */
export const DEFAULT_THROTTLE = { ttl: MINUTE, limit: 120 };

/** endpoint ที่ส่งอีเมลออกไป (เช่นสมัครสมาชิก): กันใช้เว็บเราส่งเมลถล่มคนอื่น */
export const EmailThrottle = () =>
  Throttle({ default: { ttl: MINUTE, limit: 5 } });

/** endpoint ที่เดารหัสผ่านได้ (ล็อกอิน): กันไล่เดารหัส */
export const CredentialThrottle = () =>
  Throttle({ default: { ttl: MINUTE, limit: 10 } });

/**
 * ต่ออายุ token: หน้าเว็บอาจยิงหลายคำขอพร้อมกันตอน token ใกล้หมดอายุ
 * จึงหลวมกว่า แต่ยังกันการไล่เดา refresh token ได้
 */
export const RefreshThrottle = () =>
  Throttle({ default: { ttl: MINUTE, limit: 30 } });
