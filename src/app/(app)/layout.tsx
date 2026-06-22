import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-shell/header";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Middleware already guards these routes; this is defence in depth and gives
  // server components a guaranteed-present session.
  if (!session?.user) {
    redirect("/login");
  }

  // auth() re-reads onboardingComplete from the DB on every call (Node runtime
  // jwt callback in src/auth.ts), so this always reflects the current value
  // even immediately after the onboarding action updates the DB.
  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader displayName={session.user.name ?? "Athlete"} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
