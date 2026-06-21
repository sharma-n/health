import type { Metadata } from "next";
import { auth } from "@/auth";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Profile — Health" };

export default async function ProfilePage() {
  const session = await auth();
  const user = session?.user;

  const rows = [
    { label: "Name", value: user?.name ?? "—" },
    { label: "Email", value: user?.email ?? "—" },
    {
      label: "Units",
      value: user?.unitPreference === "LBS" ? "Pounds (lbs)" : "Kilograms (kg)",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & settings" />

      <dl className="divide-y divide-border overflow-hidden rounded-[var(--radius-app)] border border-border bg-surface">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3.5"
          >
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Editing
        </h2>
        <ComingSoon milestone="Milestone 7" />
      </div>
    </div>
  );
}
