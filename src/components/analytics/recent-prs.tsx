import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import type { PersonalRecord } from "@/lib/analytics/prs";
import { PR_LABEL } from "@/lib/analytics/prs";

interface RecentPRsProps {
  prs: PersonalRecord[];
}

export function RecentPRs({ prs }: RecentPRsProps) {
  if (prs.length === 0) return null;

  const displayed = prs.slice(0, 4);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-semibold text-foreground">New Records</p>
        </div>
        <Link
          href="/analytics?tab=records"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          All PRs <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {displayed.map((pr, i) => (
          <div
            key={`${pr.exerciseId}-${pr.prType}-${i}`}
            className="flex-shrink-0 rounded-[var(--radius-app)] border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 px-3 py-2 min-w-[130px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 leading-none mb-1">
              {PR_LABEL[pr.prType]}
            </p>
            <p className="text-sm font-bold text-foreground leading-tight truncate max-w-[140px]">
              {pr.exerciseName}
            </p>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
              {pr.value % 1 === 0 ? pr.value : pr.value.toFixed(1)} {pr.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
