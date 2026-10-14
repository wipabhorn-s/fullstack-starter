// @vitest-environment node
import { proxy } from "@/proxy";
import { decode, encode, type JWT } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** ทดสอบกับคุกกี้จริงของ next-auth (เข้ารหัสด้วย AUTH_SECRET ของ test) */

const { refreshSession } = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock("@/lib/session-token", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session-token")>()),
  refreshSession,
}));

const COOKIE = "authjs.session-token";
const SECRET = "test-secret";

const accessToken = (expSeconds: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url")}.s`;

const session = (expSeconds: number): JWT => ({
  sub: "user-1",
  name: "Ann Lee",
  email: "ann@test.local",
  role: "USER",
  access_token: accessToken(expSeconds),
  refresh_token: "refresh-1",
});

async function requestWith(token: JWT) {
  const value = await encode({ token, secret: SECRET, salt: COOKIE });
  return new NextRequest("http://localhost:3000/dashboard", {
    headers: { cookie: `${COOKIE}=${value}` },
  });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe("proxy (refresh token rotation)", () => {
  beforeEach(() => {
    refreshSession.mockReset();
  });

  it("does nothing for visitors without a session", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/"));
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("leaves a fresh access token alone", async () => {
    await proxy(await requestWith(session(nowSeconds() + 600)));
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("refreshes an expiring token and hands the new cookie to both this render and the browser", async () => {
    const renewed = {
      ...session(nowSeconds() + 900),
      refresh_token: "refresh-2",
    };
    refreshSession.mockResolvedValue(renewed);

    const response = await proxy(await requestWith(session(nowSeconds() + 10)));

    // เบราว์เซอร์ได้คุกกี้ใหม่
    const setCookie = response.cookies.get(COOKIE);
    expect(setCookie?.httpOnly).toBe(true);
    const stored = await decode({
      token: setCookie!.value,
      secret: SECRET,
      salt: COOKIE,
    });
    expect(stored?.refresh_token).toBe("refresh-2");

    // หน้าที่กำลัง render ในคำขอนี้ก็เห็นคุกกี้ใหม่ (ส่งต่อผ่าน header ของคำขอ)
    const forwarded = response.headers.get("x-middleware-request-cookie") ?? "";
    expect(forwarded).toContain(setCookie!.value);
  });

  it("clears the session when the refresh token is no longer valid", async () => {
    refreshSession.mockResolvedValue(null);

    const response = await proxy(await requestWith(session(nowSeconds() - 5)));

    expect(response.cookies.get(COOKIE)?.value).toBe("");
  });

  it("keeps the session untouched when the API is down", async () => {
    refreshSession.mockImplementation((token: JWT) => Promise.resolve(token));

    const response = await proxy(await requestWith(session(nowSeconds() - 5)));

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
