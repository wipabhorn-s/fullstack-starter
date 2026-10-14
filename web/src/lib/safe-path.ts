/** origin สมมติไว้ให้ URL แยกส่วน path ออกมา (ไม่ได้ใช้เปิดจริง) */
const LOCAL_ORIGIN = "http://app.local";

/**
 * รับเฉพาะ path ภายในเว็บเรา (เช่น "/courses?page=2") ค่าอื่นคืน fallback
 *
 * ใช้กับ path ที่มาจากฝั่ง browser ก่อนส่งให้ redirect() / revalidatePath()
 * ไม่งั้นคนส่ง "https://evil.com" หรือ "//evil.com" มา เว็บเราจะพาผู้ใช้ไปเว็บอื่น
 * (open redirect: ลิงก์ดูเหมือนของเรา แต่ปลายทางเป็นเว็บหลอก)
 * ตรวจผ่าน URL จริง จึงจับรูปแบบหลบ ๆ ได้ด้วย เช่น "/\evil.com", "/\t/evil.com"
 */
export function safeLocalPath(path: unknown, fallback = "/"): string {
  if (typeof path !== "string" || !path.startsWith("/")) return fallback;

  try {
    const url = new URL(path, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
