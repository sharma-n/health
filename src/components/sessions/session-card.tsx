import Link from "next/link";
import { Dumbbell, Clock, Zap } from "lucide-react";

type SessionCardProps = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  overallEffort: number | null;
  workoutName: string | null;
  exerciseCount: number;
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function SessionCard({
  id,
  startedAt,
  endedAt,
  durationSeconds,
  overallEffort,
  workoutName,
  exerciseCount,
}: SessionCardProps) {
  const isActive = !endedAt;

  return (
    <Link
      href={`/sessions/${id}`}
      className="block rounded-[var(--radius-app)] border border-border bg-surface p-4 transition-colors hover:border-primary/40 active:bg-surface-muted"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">
            {workoutName ?? "Ad-hoc session"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(startedAt)}
          </p>
        </div>
        {isActive ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
            Active
          </span>
        ) : overallEffort ? (
          <span className="shrink-0 flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            RPE {overallEffort}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Dumbbell className="h-3 w-3" />
          {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
        </span>
        {durationSeconds !== null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(durationSeconds)}
          </span>
        )}
      </div>
    </Link>
  );
}
