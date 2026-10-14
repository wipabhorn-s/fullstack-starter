import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">My App</h1>
      <p className="text-muted-foreground">
        NestJS + Prisma API, Next.js + next-auth web. Replace this page with
        your own landing page.
      </p>

      <div className="flex gap-3">
        {session ? (
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Log in
            </Link>
            <Link
              href="/signup"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
