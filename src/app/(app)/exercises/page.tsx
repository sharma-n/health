import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Exercises — Health" };

export default function ExercisesPage() {
  return (
    <div>
      <PageHeader
        title="Exercises"
        description="Your library of movements, filterable by muscle and equipment."
      />
      <ComingSoon milestone="Milestone 3" />
    </div>
  );
}
