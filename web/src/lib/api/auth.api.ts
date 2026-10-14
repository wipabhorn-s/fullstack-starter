import { apiFetch } from "@/lib/api/api-fetch";
import { LoginResponse, UserResponse } from "@/lib/api/api.type";
import { LoginInput, RegisterInput } from "@/lib/schemas/auth.schema";

export const AuthApi = {
  register(data: RegisterInput) {
    return apiFetch<LoginResponse>("/auth/register", {
      method: "POST",
      body: data,
    });
  },

  login(data: LoginInput) {
    return apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: data,
      // ล็อกอินส่งซ้ำได้ ไม่เกิดข้อมูลซ้ำ รอ API ตื่นแทนการขึ้น error
      retry: true,
    });
  },

  loginWithGoogle(idToken: string) {
    return apiFetch<LoginResponse>("/auth/google", {
      method: "POST",
      body: { idToken },
      // กลับมาจากหน้า Google แล้ว API ยังหลับอยู่ = ล็อกอินไม่ผ่าน ต้องรอให้ตื่น
      retry: true,
    });
  },

  /** แลก refresh token เป็น access token ใบใหม่ (refresh token ก็ได้ใบใหม่ด้วย) */
  refresh(refreshToken: string, clientIp?: string) {
    return apiFetch<LoginResponse>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      clientIp,
    });
  },

  /** Log out เครื่องนี้: ยกเลิก refresh token ที่ API */
  logout(refreshToken: string) {
    return apiFetch<{ message: string }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    });
  },

  /** ข้อมูลล่าสุดจากฐานข้อมูล (session อาจเก่ากว่านี้) */
  me(token: string) {
    return apiFetch<UserResponse>("/users/me", { token, cache: "no-store" });
  },
};
