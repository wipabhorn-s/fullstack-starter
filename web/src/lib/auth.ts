import { ApiError } from "@/lib/api/api-error";
import { AuthApi } from "@/lib/api/auth.api";
import type { LoginResponse } from "@/lib/api/api.type";
import { env, googleEnabled } from "@/lib/env";
import { loginSchema, registerSchema } from "@/lib/schemas/auth.schema";
import { SESSION_MAX_AGE, storeTokens } from "@/lib/session-token";
import NextAuth, { CredentialsSignin, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

/**
 * next-auth มองว่าการล็อกอินล้มเหลวเป็นเรื่องเดียวกันหมด แล้วตอบ
 * CredentialsSignin กลับมาเฉย ๆ ถ้า return null ทุกกรณี คนที่โดนระงับบัญชี
 * จะเห็นแค่ "รหัสผ่านผิด"
 *
 * throw ตัวนี้แทน code ที่ API ส่งมาจึงเดินทางไปถึง server action ได้
 */
export class LoginError extends CredentialsSignin {
  constructor(readonly code: string) {
    super(code);
  }
}

/** แปลง error จาก API เป็น LoginError ให้ server action แยกข้อความได้ */
function toLoginError(error: unknown, fallback: string): LoginError {
  // API ล่มหรือต่อไม่ติด ไม่ใช่ "รหัสผ่านผิด" — ต้องแยกให้ออก
  // ไม่งั้นผู้ใช้จะนั่งพิมพ์รหัสซ้ำทั้งที่ไม่มีอะไรผิดเลย
  if (!(error instanceof ApiError)) return new LoginError("SERVICE_UNAVAILABLE");

  // ยิงคำขอถี่เกิน rate limit ของ API (ไม่เกี่ยวกับรหัสผ่านถูกหรือผิด)
  if (error.statusCode === 429) return new LoginError("TOO_MANY_REQUESTS");
  if (error.statusCode === 400) return new LoginError("VALIDATION_ERROR");

  return new LoginError(error.code ?? fallback);
}

function toSessionUser({ user, access_token, refresh_token }: LoginResponse) {
  return { ...user, access_token, refresh_token } satisfies User;
}

/**
 * Credentials ตัวเดียวรับทั้งล็อกอินและสมัคร (intent: "register")
 * สมัครเสร็จ API ออก token ให้เลย จึงได้ session ในขั้นตอนเดียว
 */
async function authorize(input: Partial<Record<string, unknown>>) {
  if (input.intent === "register") {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new LoginError("VALIDATION_ERROR");

    try {
      return toSessionUser(await AuthApi.register(parsed.data));
    } catch (error) {
      throw toLoginError(error, "VALIDATION_ERROR");
    }
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) throw new LoginError("INVALID_CREDENTIALS");

  try {
    return toSessionUser(await AuthApi.login(parsed.data));
  } catch (error) {
    throw toLoginError(error, "INVALID_CREDENTIALS");
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  // อายุเท่า refresh token ของ API ระหว่างนี้ proxy.ts ต่ออายุ access token ให้เรื่อย ๆ
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/login", error: "/login" },

  providers: [
    Credentials({ authorize }),
    // ไม่ตั้ง GOOGLE_CLIENT_ID/SECRET = ไม่มี provider นี้ (หน้า login ซ่อนปุ่มด้วย)
    ...(googleEnabled
      ? [
          Google({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // กลับมาจาก Google: ส่ง id_token ให้ API ตรวจเอง แล้วใช้ token ของ API แทน
      // (session ของเว็บไม่เคยใช้ token ของ Google เรียก API ตรง ๆ)
      if (account?.provider === "google" && account.id_token) {
        const result = await AuthApi.loginWithGoogle(account.id_token);
        return storeTokens(token, result, result.user);
      }

      if (user) {
        storeTokens(token, user, user);
      }

      return token;
    },

    session({ token, session }) {
      session.user.id = token.sub;
      session.user.name = token.name;
      session.user.email = token.email;
      session.user.role = token.role;
      session.user.access_token = token.access_token;
      return session;
    },
  },
});
