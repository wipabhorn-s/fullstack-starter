"use server";

import { ErrorActionResult } from "@/lib/actions/action.type";
import { signIn, signOut } from "@/lib/auth";
import { loginErrorMessage } from "@/lib/login-errors";
import {
  LoginInput,
  RegisterInput,
  registerSchema,
} from "@/lib/schemas/auth.schema";
import { revokeCurrentSession } from "@/lib/session-token";
import { CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import z from "zod";

/** ล็อกอินและสมัครจบเหมือนกัน: ผ่านแล้วไป dashboard ไม่ผ่านคืน code ให้ฟอร์มแสดง */
async function signInWithCredentials(
  fields: Record<string, string>,
): Promise<ErrorActionResult | void> {
  try {
    await signIn("credentials", { ...fields, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      const code = error.code ?? "INVALID_CREDENTIALS";
      return { success: false, message: loginErrorMessage(code), code };
    }
    throw error;
  }

  redirect("/dashboard");
}

export async function loginAction(
  input: LoginInput,
): Promise<ErrorActionResult | void> {
  return signInWithCredentials(input);
}

export async function registerAction(
  input: RegisterInput,
): Promise<ErrorActionResult | void> {
  // ตรวจซ้ำฝั่ง server เสมอ ค่าที่มาจาก browser แก้ได้ทุกอย่าง
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: loginErrorMessage("VALIDATION_ERROR"),
      errors: z.flattenError(parsed.error),
      code: "VALIDATION_ERROR",
    };
  }

  return signInWithCredentials({ ...parsed.data, intent: "register" });
}

export async function loginWithGoogleAction(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function logoutAction(): Promise<void> {
  await revokeCurrentSession();
  await signOut({ redirectTo: "/" });
}
