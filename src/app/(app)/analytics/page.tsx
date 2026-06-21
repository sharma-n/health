import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Analytics — Health" };

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Progression, personal records, adherence and volume."
      />
      <ComingSoon milestone="Milestone 8" />
    </div>
  );
}
