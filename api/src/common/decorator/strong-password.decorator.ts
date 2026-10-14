import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

/**
 * กฎรหัสผ่านชุดเดียวกับ web/src/lib/schemas/password.schema.ts — แก้ที่หนึ่ง
 * ต้องแก้อีกที่ด้วย
 *
 * - 8-72 ตัว: bcrypt อ่านแค่ 72 ไบต์แรกแล้วตัดที่เหลือทิ้งเงียบ ๆ
 * - ASCII ที่พิมพ์ได้เท่านั้น (ไม่มีช่องว่าง ไม่มีภาษาไทย) หนึ่งตัวจึงเท่ากับ
 *   หนึ่งไบต์ ความยาวที่นับได้ตรงกับที่ bcrypt เห็นจริง
 * - ต้องมีพิมพ์เล็ก พิมพ์ใหญ่ ตัวเลข และอักขระพิเศษอย่างน้อยอย่างละตัว
 *
 * รวมเป็น regex เดียวเพราะ class-validator เก็บ error ตามชื่อ constraint
 * ใส่ @Matches() หลายตัวข้อความจะทับกันเหลืออันเดียวอยู่ดี
 */
export const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!-/:-@[-`{-~])[\x21-\x7E]{8,72}$/;

export function StrongPassword() {
  return applyDecorators(
    IsString(),
    Matches(STRONG_PASSWORD, {
      message:
        '$property must be 8-72 characters of English letters, numbers and symbols (no spaces), with at least one lowercase letter, one uppercase letter, one number and one special character',
    }),
  );
}
