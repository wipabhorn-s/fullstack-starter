import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * เฉพาะ ADMIN — ผู้ใช้ทั่วไปถูกพากลับ dashboard
 * role ใน session อาจเก่าได้ถึงรอบ refresh ถัดไป (ไม่เกินอายุ access token)
 * แต่ไม่ใช่ช่องโหว่: API เช็ก @Roles(ADMIN) จาก token ทุกคำขออยู่แล้ว
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return children;
}
