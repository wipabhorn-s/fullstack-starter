import { handlers } from "@/lib/auth";
import type { NextRequest } from "next/server";

export const { POST } = handlers;

/**
 * GET /api/auth/session ส่ง session ให้ JavaScript ในเบราว์เซอร์อ่านได้
 * session มี access token ของ API อยู่ (โค้ดฝั่ง server ใช้ผ่าน auth())
 * ถ้าหน้าเว็บโดนแทรกสคริปต์ (XSS) สคริปต์นั้นจะขอ token ไปใช้ได้ จึงตัดทิ้งก่อนส่งออก
 * (template นี้ไม่ได้ใช้ useSession ฝั่ง browser ถ้าจะใช้ ห้ามพึ่ง access_token ใน session)
 */
export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  if (!request.nextUrl.pathname.endsWith("/session")) return response;

  const session = (await response
    .clone()
    .json()
    .catch(() => null)) as {
    user?: { access_token?: string };
  } | null;
  if (!session?.user) return response;

  delete session.user.access_token;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(session, { status: response.status, headers });
}
