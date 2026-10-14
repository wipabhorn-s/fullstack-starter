import AppHeader from "@/components/layout/AppHeader";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * ทุกหน้าใน (app) ต้องล็อกอิน
 * เช็กใน layout = กันการ "เห็นหน้า" เท่านั้น ข้อมูลจริงยังผ่าน AuthGuard ของ API ทุกครั้ง
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <AppHeader name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
