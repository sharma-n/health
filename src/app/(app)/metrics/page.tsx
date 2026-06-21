import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Body metrics — Health" };

export default function MetricsPage() {
  return (
    <div>
      <PageHeader
        title="Body metrics"
        description="Log bodyweight and measurements over time."
      />
      <ComingSoon milestone="Milestone 7" />
    </div>
  );
}
