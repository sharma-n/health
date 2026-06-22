import { auth } from "@/auth";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export const metadata = {
  title: "Complete Setup",
};

export default async function OnboardingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <OnboardingForm unitPreference={session.user.unitPreference} />
      </div>
    </div>
  );
}
