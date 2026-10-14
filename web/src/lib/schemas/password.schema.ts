import z from "zod";

/**
 * กฎรหัสผ่านชุดเดียวที่ใช้ทุกจุดที่ตั้งรหัสใหม่ได้ (สมัคร / reset / เปลี่ยน /
 * ตั้งครั้งแรก) ต้องตรงกับ @StrongPassword() ฝั่ง API เสมอ แก้ที่หนึ่งต้องแก้
 * อีกที่ด้วย ไม่งั้นหน้าเว็บจะบอกว่าผ่านแต่ API ตอบ 400
 *
 * สูงสุด 72 ตัวเพราะ bcrypt อ่านแค่ 72 ไบต์แรกแล้วตัดที่เหลือทิ้งเงียบ ๆ
 * รับเฉพาะ ASCII ที่พิมพ์ได้ ตัวอักษรหนึ่งตัวจึงเท่ากับหนึ่งไบต์พอดี
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const PRINTABLE_ASCII = /^[\x21-\x7E]*$/;
const SPECIAL_CHARACTER = /[!-/:-@[-`{-~]/;

export type PasswordRule = {
  /** คำแนะนำที่แสดงตอนข้อนี้ยังไม่ผ่าน */
  hint: string;
  test: (value: string) => boolean;
};

/** เรียงตามลำดับที่อยากให้ผู้ใช้แก้ แถบความแข็งแรงบอกข้อแรกที่ยังขาดทีละข้อ */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    hint: `Use at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    hint: "Add a lowercase letter (a-z)",
    test: (value) => /[a-z]/.test(value),
  },
  {
    hint: "Add an uppercase letter (A-Z)",
    test: (value) => /[A-Z]/.test(value),
  },
  { hint: "Add a number (0-9)", test: (value) => /[0-9]/.test(value) },
  {
    hint: "Add a symbol like ! @ # $",
    test: (value) => SPECIAL_CHARACTER.test(value),
  },
];

/** ไม่นับเป็นช่องในแถบ แต่ถ้าผิดข้อนี้ต้องบอกก่อนข้ออื่น เพราะแก้ข้ออื่นก็ไม่ผ่าน */
export const PASSWORD_CHARSET_RULE: PasswordRule = {
  hint: "Only English letters, numbers and symbols — no spaces",
  test: (value) => PRINTABLE_ASCII.test(value),
};

export const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  )
  .regex(
    PRINTABLE_ASCII,
    "Password can only contain English letters, numbers and symbols (no spaces)",
  )
  .regex(/[a-z]/, "Password must contain a lowercase letter (a-z)")
  .regex(/[A-Z]/, "Password must contain an uppercase letter (A-Z)")
  .regex(/[0-9]/, "Password must contain a number (0-9)")
  .regex(SPECIAL_CHARACTER, "Password must contain a special character");
