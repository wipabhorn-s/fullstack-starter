import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthApi } from "@/lib/api/auth.api";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // ตัวอย่างการเรียก API ที่ต้องล็อกอิน: ส่ง access token จาก session ไปกับ apiFetch
  // token หมดอายุ / บัญชีถูกระงับ = apiFetch พาไป /session-expired ให้เอง
  const me = await AuthApi.me(session.user.access_token);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Welcome, {me.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>Loaded from GET /users/me</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{me.email}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>{me.role}</dd>
            <dt className="text-muted-foreground">Member since</dt>
            <dd>{new Date(me.createdAt).toLocaleDateString("en-GB")}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
