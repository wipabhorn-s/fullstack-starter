import AuthCard from "@/components/features/auth/AuthCard";
import LoginForm from "@/components/features/auth/LoginForm";
import { redirectErrorMessage } from "@/lib/login-errors";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard
      title="Log in"
      googleLabel="Continue with Google"
      description={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium underline">
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm initialError={redirectErrorMessage(error)} />
    </AuthCard>
  );
}
