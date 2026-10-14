import { clientIpFrom } from "@/lib/api/api-fetch";
import { env } from "@/lib/env";
import {
  needsRefresh,
  refreshSession,
  SESSION_COOKIES,
  SESSION_MAX_AGE,
} from "@/lib/session-token";
import { decode, encode } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

/**
 * ต่ออายุ access token ก่อนหมดอายุ (refresh token rotation)
 *
 * ต้องทำที่นี่ ไม่ใช่ใน callback jwt ของ NextAuth: Server Component เขียนคุกกี้ไม่ได้
 * ถ้าไปต่ออายุตอน render หน้า token ใบใหม่จะหายไป แล้วรอบหน้าก็เอาใบเก่าที่ใช้ไปแล้ว
 * มาขอซ้ำ API จะนึกว่า token หลุดแล้วตัดทุก session ทิ้ง
 *
 * ที่นี่เขียนคุกกี้ใหม่ได้ทั้งใน "คำขอ" (หน้าที่กำลัง render เห็น token ใหม่ทันที)
 * และใน "คำตอบ" (เบราว์เซอร์เก็บไว้ใช้รอบถัดไป)
 */
export async function proxy(request: NextRequest) {
  const name = SESSION_COOKIES.find((cookie) => request.cookies.has(cookie));
  const value = name && request.cookies.get(name)?.value;
  if (!name || !value) return NextResponse.next();

  const token = await decode({
    token: value,
    secret: env.AUTH_SECRET,
    salt: name,
  });
  if (!token || !needsRefresh(token)) return NextResponse.next();

  // proxy อ่าน header ด้วย next/headers ไม่ได้ ส่ง IP ของผู้ใช้ให้ API เอง (rate limit)
  const refreshed = await refreshSession(token, clientIpFrom(request.headers));
  if (refreshed === token) return NextResponse.next(); // API ต่อไม่ติด ลองใหม่คำขอหน้า

  if (!refreshed) {
    // refresh token ใช้ไม่ได้แล้ว: ลบ session หน้าที่ต้องล็อกอินจะพาไปหน้า login เอง
    request.cookies.delete(name);
    const response = NextResponse.next({
      request: { headers: request.headers },
    });
    response.cookies.delete(name);
    return response;
  }

  const updated = await encode({
    token: refreshed,
    secret: env.AUTH_SECRET,
    salt: name,
    maxAge: SESSION_MAX_AGE,
  });
  request.cookies.set(name, updated);

  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(name, updated, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: name.startsWith("__Secure-"),
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export const config = {
  // ทุกหน้ายกเว้นไฟล์ static (รูป, ไฟล์ build ของ Next) ไม่ต้องเช็ก session
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|gif)$).*)",
  ],
};
