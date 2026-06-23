import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { PlanStatus } from "@/lib/constants";
import { formatDateOnly } from "@/lib/dates";

export type PlanListItem = {
  id: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: string;
  _count: { schedule: number };
};

const STATUS_STYLES: Record<PlanStatus, string> = {
  DRAFT: "border-border text-muted-foreground",
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  COMPLETED: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  ARCHIVED: "border-border bg-surface-muted text-muted-foreground",
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function formatDate(d: Date) {
  return formatDateOnly(d, { month: "short", day: "numeric", year: "numeric" });
}

export function PlanCard({ plan }: { plan: PlanListItem }) {
  const status = plan.status as PlanStatus;
  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block rounded-[var(--radius-app)] border border-border bg-surface p-4 transition-colors hover:border-primary/40 active:bg-surface-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground leading-snug">{plan.name}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs shrink-0 ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}
        >
          {STATUS_LABELS[status] ?? plan.status}
        </span>
      </div>

      {plan.description ? (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{plan.description}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
        </span>
        <span>·</span>
        <span>
          {plan._count.schedule} day{plan._count.schedule !== 1 ? "s" : ""}/week
        </span>
      </div>
    </Link>
  );
}
