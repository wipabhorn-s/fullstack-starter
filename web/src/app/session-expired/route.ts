import { signOut } from "@/lib/auth";
import { revokeCurrentSession } from "@/lib/session-token";
import type { NextRequest } from "next/server";

/**
 * apiFetch พามาที่นี่เมื่อ API ตอบ 401 (หรือ 403 ACCOUNT_SUSPENDED) ทั้งที่ส่ง token ไป
 * server component แก้คุกกี้เองไม่ได้ จึงต้องมาล้าง session ใน route handler
 * ยกเลิก refresh token ที่ API ด้วย (ถ้ายังใช้ได้อยู่) ไม่ให้เหลือ session ค้าง
 */
export async function GET(request: NextRequest) {
  const suspended = request.nextUrl.searchParams.get("reason") === "suspended";

  await revokeCurrentSession();
  await signOut({
    redirectTo: suspended ? "/login?error=AccountSuspended" : "/login",
  });
}
