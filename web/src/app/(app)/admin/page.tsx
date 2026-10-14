import UserStatusButton from "@/components/features/admin/UserStatusButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminApi } from "@/lib/api/admin.api";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const page = Math.max(1, Number((await searchParams).page) || 1);
  const users = await AdminApi.findUsers(session.user.access_token, { page });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          {users.total} accounts · suspending signs the user out on their next
          request
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {users.items.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-2">{user.name}</td>
                  <td className="py-2">{user.email}</td>
                  <td className="py-2">{user.role}</td>
                  <td className="py-2">{user.status}</td>
                  <td className="py-2 text-right">
                    <UserStatusButton
                      userId={user.id}
                      status={user.status}
                      disabled={user.id === session.user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.totalPages > 1 && (
          <nav className="mt-4 flex justify-between text-sm">
            {page > 1 ? (
              <Link href={`/admin?page=${page - 1}`}>← Previous</Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {users.page} of {users.totalPages}
            </span>
            {page < users.totalPages ? (
              <Link href={`/admin?page=${page + 1}`}>Next →</Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
