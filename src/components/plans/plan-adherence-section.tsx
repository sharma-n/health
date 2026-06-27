import Link from "next/link";
import { StatCard } from "@/components/analytics/stat-card";
import type { OccurrenceStatus, OccurrenceResult, PlanAdherenceResult } from "@/lib/analytics/plan-adherence";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Offset in days from Monday for each getDay() index (Sun=0 … Sat=6)
const DOW_TO_MONDAY_OFFSET = [6, 0, 1, 2, 3, 4, 5];

function fmtDate(weekMonday: string, offsetFromMonday: number): string {
  const d = new Date(weekMonday + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetFromMonday);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const STATUS_BADGE: Record<OccurrenceStatus, { label: string; className: string }> = {
  completed: {
    label: "Done",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  },
  completed_late: {
    label: "Done (late)",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-600",
  },
  completed_early: {
    label: "Done (early)",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-600",
  },
  missed: {
    label: "Missed",
    className: "border-danger/30 bg-danger/10 text-danger",
  },
  upcoming: {
    label: "Scheduled",
    className: "border-border bg-surface-muted text-muted-foreground",
  },
};

interface PlanAdherenceSectionProps {
  adherence: PlanAdherenceResult;
  scheduleByDay: Map<number, { id: string; name: string }>;
  isActive: boolean;
}

export function PlanAdherenceSection({
  adherence,
  scheduleByDay,
  isActive,
}: PlanAdherenceSectionProps) {
  const { overall, thisWeek } = adherence;

  const thisWeekByDay = new Map<number, OccurrenceResult>();
  for (const occ of thisWeek) {
    thisWeekByDay.set(occ.dayOfWeek, occ);
  }

  return (
    <>
      {isActive && (
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            This Week
          </p>
          <ul className="space-y-2">
            {DAYS.map((label, dow) => {
              const workout = scheduleByDay.get(dow);
              const occ = thisWeekByDay.get(dow);
              const badge = occ ? STATUS_BADGE[occ.status] : null;
              return (
                <li key={dow} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 font-medium text-muted-foreground">
                    {label}{adherence.thisWeekStart ? (
                      <span className="ml-1 text-xs font-normal">
                        {fmtDate(adherence.thisWeekStart, DOW_TO_MONDAY_OFFSET[dow])}
                      </span>
                    ) : null}
                  </span>
                  {workout ? (
                    <>
                      <Link
                        href={`/workouts/${workout.id}`}
                        className="min-w-0 flex-1 truncate text-primary underline-offset-4 hover:underline"
                      >
                        {workout.name}
                      </Link>
                      {badge && (
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Rest</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Overall Progress
        </p>
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Done" value={overall.completed} accent="emerald" />
          <StatCard
            label="Missed"
            value={overall.missed}
            accent={overall.missed > 0 ? "amber" : "default"}
          />
          <StatCard label="Upcoming" value={overall.upcoming} />
          <StatCard
            label="Adherence"
            value={overall.adherencePct != null ? `${overall.adherencePct}%` : "—"}
            accent={
              overall.adherencePct != null && overall.adherencePct >= 80 ? "emerald" : "default"
            }
          />
        </div>
      </div>
    </>
  );
}
