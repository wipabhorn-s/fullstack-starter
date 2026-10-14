import AuthCard from "@/components/features/auth/AuthCard";
import SignupForm from "@/components/features/auth/SignupForm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      googleLabel="Sign up with Google"
      description={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
