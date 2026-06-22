import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = {
  title: "Complete Setup",
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // auth() re-reads from DB on every call in the Node runtime, so this check
  // is always fresh — no stale JWT values.
  if (session.user.onboardingComplete) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <OnboardingForm unitPreference={session.user.unitPreference} />
      </div>
    </div>
  );
}
