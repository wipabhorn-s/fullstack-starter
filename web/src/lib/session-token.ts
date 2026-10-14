import { ApiError } from "@/lib/api/api-error";
import type { UserResponse } from "@/lib/api/api.type";
import { AuthApi } from "@/lib/api/auth.api";
import { env } from "@/lib/env";
import { decode, type JWT } from "next-auth/jwt";
import { cookies } from "next/headers";

/**
 * อายุ session ของ next-auth = อายุ refresh token ของ API (REFRESH_TOKEN_EXPIRES_IN)
 * ไม่ได้เข้าใช้นานเท่านี้ต้องล็อกอินใหม่ ใช้งานอยู่เรื่อย ๆ ไม่หลุด
 */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/** ต่ออายุก่อนหมดจริงสักหน่อย เผื่อเวลาที่คำขอวิ่งไปถึง API */
const REFRESH_BEFORE_MS = 60_000;

/** ชื่อคุกกี้ session ของ next-auth (https ใส่คำนำหน้า __Secure-) */
export const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
] as const;

/** เวลาหมดอายุของ access token (ms) อ่านจาก exp ใน JWT ของ API เอง ไม่ต้องให้ API ส่งแยกมา */
export function accessTokenExpiry(accessToken: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
    ) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function needsRefresh(token: JWT): boolean {
  if (!token.refresh_token || !token.access_token) return false;
  const expires =
    token.accessTokenExpires ?? accessTokenExpiry(token.access_token);
  return Date.now() > expires - REFRESH_BEFORE_MS;
}

/** เก็บ token ชุดใหม่ (และข้อมูลผู้ใช้ล่าสุด) ลง JWT ของ next-auth */
export function storeTokens(
  token: JWT,
  tokens: { access_token: string; refresh_token?: string },
  user?: Pick<UserResponse, "id" | "name" | "email" | "role">,
): JWT {
  token.access_token = tokens.access_token;
  token.accessTokenExpires = accessTokenExpiry(tokens.access_token);
  if (tokens.refresh_token) token.refresh_token = tokens.refresh_token;

  if (user) {
    token.sub = user.id;
    token.name = user.name;
    token.email = user.email;
    token.role = user.role;
  }
  return token;
}

/**
 * ขอ access token ใบใหม่ด้วย refresh token
 * - สำเร็จ: คืน token ที่อัปเดตแล้ว
 * - API ปฏิเสธ (หมดอายุ / ถูกยกเลิก / ใช้ซ้ำ / บัญชีถูกระงับ): คืน null = ต้องล็อกอินใหม่
 * - API ต่อไม่ติด: คืน token เดิม ไม่เตะผู้ใช้ออกเพราะ API ล่มชั่วคราว
 */
export async function refreshSession(
  token: JWT,
  clientIp?: string,
): Promise<JWT | null> {
  if (!token.refresh_token) return null;

  try {
    const result = await AuthApi.refresh(token.refresh_token, clientIp);
    return storeTokens({ ...token }, result, result.user);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.statusCode === 401 || error.statusCode === 403)
    ) {
      return null;
    }
    return token;
  }
}

/** อ่าน JWT ของ next-auth จากคุกกี้ (ใช้ใน server action / route handler) */
export async function readSessionToken(): Promise<JWT | null> {
  const store = await cookies();
  const name = SESSION_COOKIES.find((cookie) => store.has(cookie));
  const value = name && store.get(name)?.value;
  if (!name || !value) return null;

  return decode({ token: value, secret: env.AUTH_SECRET, salt: name });
}

/**
 * Log out เครื่องนี้ฝั่ง API: ยกเลิก refresh token ของ session ปัจจุบัน
 * เรียกก่อน signOut() เสมอ ไม่งั้น token ยังใช้ขอใบใหม่ได้แม้คุกกี้ถูกลบแล้ว
 * API ล่มก็ไม่ขัดการ log out ฝั่งเว็บ
 */
export async function revokeCurrentSession(): Promise<void> {
  try {
    const token = await readSessionToken();
    if (token?.refresh_token) await AuthApi.logout(token.refresh_token);
  } catch {
    // ปล่อยผ่าน: อย่างน้อยคุกกี้ฝั่งเว็บก็ถูกลบ และ token หมดอายุเองตามเวลา
  }
}
