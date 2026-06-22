import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computeGoalProgress } from "@/lib/analytics/goals";
import { GOAL_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Goal — Health" };

interface Props {
  params: Promise<{ id: string }>;
}

function displayConfigValue(goal: any): string {
  const { type, config } = goal;
  if (type === "STRENGTH") {
    return `${config.exerciseId} — ${config.metric === "1RM" ? "1RM" : `${config.reps} reps`} target: ${config.targetValueKg} kg`;
  }
  if (type === "BODY_METRIC") {
    return `${config.metricType} — target: ${config.targetValue} (${config.direction})`;
  }
  if (type === "CONSISTENCY") {
    return `${config.workoutsPerWeek} workouts/week`;
  }
  return "";
}

export default async function GoalDetailPage(props: Props) {
  const params = await props.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const goal = await prisma.goal.findUnique({
    where: { id: params.id },
  });

  if (!goal || goal.userId !== userId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Goal not found.</p>
      </div>
    );
  }

  const progress = await computeGoalProgress(goal, prisma);

  return (
    <div className="space-y-4">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Goals
      </Link>

      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{goal.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{goal.type}</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress.percentage)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Current vs target */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4 space-y-2">
          {progress.current !== null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current</span>
              <span className="text-lg font-semibold text-foreground">
                {typeof progress.current === "number" ? progress.current.toFixed(2) : progress.current} {progress.unit}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Target</span>
            <span className="text-lg font-semibold text-foreground">
              {progress.target.toFixed(2)} {progress.unit}
            </span>
          </div>
        </div>

        {/* Config details */}
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
          <p className="text-sm text-muted-foreground">{displayConfigValue(goal)}</p>
        </div>

        {/* Status and actions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Status</span>
            <span className="px-2 py-1 rounded-full bg-muted text-sm font-medium text-foreground">
              {goal.status}
            </span>
          </div>
          {goal.targetDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Target Date</span>
              <span className="text-sm font-medium text-foreground">
                {new Date(goal.targetDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Edit button */}
        <Link
          href={`/goals/${goal.id}/edit`}
          className="block w-full h-11 rounded-[var(--radius-app)] bg-primary text-center leading-11 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Edit Goal
        </Link>
      </div>
    </div>
  );
}
