import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth.action";
import type { Role } from "@/lib/api/api.type";
import Link from "next/link";

export default function AppHeader({ name, role }: { name: string; role: Role }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold">
          My App
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          {/* ซ่อนลิงก์เพื่อความสะดวกเท่านั้น หน้า admin เช็ก role เองอีกชั้น */}
          {role === "ADMIN" && (
            <Link href="/admin" className="hover:text-foreground">
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{name}</span>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
