import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { PlanCard, type PlanListItem } from "./plan-card";

export function PlanList({ plans }: { plans: PlanListItem[] }) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-app)] border border-dashed border-border bg-surface px-6 py-12 text-center">
        <CalendarDays className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No plans yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a weekly routine to schedule your workouts.
        </p>
        <Link
          href="/plans/new"
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Create plan
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {plans.map((plan) => (
        <li key={plan.id}>
          <PlanCard plan={plan} />
        </li>
      ))}
    </ul>
  );
}
