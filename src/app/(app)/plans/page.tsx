import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Plans — Health" };

export default function PlansPage() {
  return (
    <div>
      <PageHeader
        title="Plans"
        description="Schedule workouts across the week over a date range."
      />
      <ComingSoon milestone="Milestone 5" />
    </div>
  );
}
