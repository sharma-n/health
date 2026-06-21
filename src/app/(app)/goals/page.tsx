import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Goals — Health" };

export default function GoalsPage() {
  return (
    <div>
      <PageHeader
        title="Goals"
        description="Strength, body-metric and consistency goals, tracked automatically."
      />
      <ComingSoon milestone="Milestone 7" />
    </div>
  );
}
