import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Workouts — Health" };

export default function WorkoutsPage() {
  return (
    <div>
      <PageHeader
        title="Workouts"
        description="Reusable templates: ordered exercises with target sets and reps."
      />
      <ComingSoon milestone="Milestone 4" />
    </div>
  );
}
