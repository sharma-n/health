import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Log — Health" };

export default function SessionsPage() {
  return (
    <div>
      <PageHeader
        title="Log a session"
        description="Track weights, reps, rest and effort as you train."
      />
      <ComingSoon milestone="Milestone 6" />
    </div>
  );
}
