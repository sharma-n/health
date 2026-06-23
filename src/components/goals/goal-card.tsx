import Link from "next/link";
import { formatDateOnly } from "@/lib/dates";

interface GoalProgress {
  current: number | null;
  target: number;
  percentage: number;
  unit: string;
}

interface GoalCardProps {
  goal: {
    id: string;
    type: string;
    title: string;
    status: string;
    targetDate?: Date | null;
    config: any;
  };
  progress: GoalProgress;
}

export function GoalCard({ goal, progress }: GoalCardProps) {
  const isCompleted = goal.status === "ACHIEVED" || goal.status === "FAILED";

  return (
    <Link href={`/goals/${goal.id}`}>
      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4 hover:border-primary transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{goal.title}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                {goal.type}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {progress.current !== null
                    ? `${typeof progress.current === "number" ? progress.current.toFixed(1) : progress.current} / ${progress.target.toFixed(1)} ${progress.unit}`
                    : `Target: ${progress.target.toFixed(1)} ${progress.unit}`}
                </span>
                <span className="font-medium text-foreground">{Math.round(progress.percentage)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isCompleted ? "bg-success" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, progress.percentage)}%` }}
                />
              </div>
            </div>

            {goal.targetDate && (
              <p className="text-xs text-muted-foreground">
                Target: {formatDateOnly(goal.targetDate)}
              </p>
            )}
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              goal.status === "ACTIVE"
                ? "bg-primary/10 text-primary"
                : goal.status === "ACHIEVED"
                  ? "bg-success/10 text-success"
                  : goal.status === "FAILED"
                    ? "bg-danger/10 text-danger"
                    : "bg-muted text-muted-foreground"
            }`}>
              {goal.status}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
