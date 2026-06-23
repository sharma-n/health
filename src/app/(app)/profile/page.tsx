import type { Metadata } from "next";
import { auth } from "@/auth";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProfileEditor } from "@/components/profile/profile-editor";

export const metadata: Metadata = { title: "Profile — Health" };

export default async function ProfilePage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & settings" />

      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Email
        </p>
        <p className="font-medium">{user?.email ?? "—"}</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Edit profile
        </h2>
        <div className="max-w-sm">
          <ProfileEditor
            displayName={user?.name ?? ""}
            unitPreference={user?.unitPreference ?? "KG"}
            timezone={user?.timezone ?? "UTC"}
          />
        </div>
      </div>
    </div>
  );
}
