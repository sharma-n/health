import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account — Health" };

export default function RegisterPage() {
  const registrationEnabled = process.env.ALLOW_REGISTRATION !== "false";

  if (!registrationEnabled) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Registration disabled
        </h1>
        <p className="text-sm text-muted-foreground">
          Open sign-up is turned off on this server. Ask the administrator for
          an account.
        </p>
        <Link
          href="/login"
          className="inline-block font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start programming your workouts in minutes.
        </p>
      </div>

      <RegisterForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
