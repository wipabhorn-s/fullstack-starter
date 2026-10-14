"use server";

import { ErrorActionResult } from "@/lib/actions/action.type";
import { ApiError } from "@/lib/api/api-error";
import { AdminApi } from "@/lib/api/admin.api";
import type { UserStatus } from "@/lib/api/api.type";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import z from "zod";

const inputSchema = z.object({
  userId: z.uuid(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

/**
 * Server Action เรียกได้จากทุกที่ ไม่ใช่แค่จากหน้า admin — เช็ก role ตรงนี้
 * เป็นแค่ตัวกรองให้ข้อความดีขึ้น ตัวจริงที่กันคือ @Roles(ADMIN) ฝั่ง API
 */
export async function updateUserStatusAction(
  userId: string,
  status: UserStatus,
): Promise<{ success: true } | ErrorActionResult> {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") {
    return { success: false, message: "Admins only", code: "FORBIDDEN" };
  }

  const parsed = inputSchema.safeParse({ userId, status });
  if (!parsed.success) {
    return { success: false, message: "Invalid input", code: "VALIDATION_ERROR" };
  }

  try {
    await AdminApi.updateUserStatus(
      parsed.data.userId,
      parsed.data.status,
      session.user.access_token,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        success: false,
        message: error.message,
        code: error.code ?? "API_ERROR",
      };
    }
    throw error;
  }

  revalidatePath("/admin");
  return { success: true };
}
