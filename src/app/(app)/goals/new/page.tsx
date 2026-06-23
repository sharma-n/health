import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { GoalForm } from "@/components/goals/goal-form";
import { createGoalAction } from "@/lib/actions/goal";
import { getPersonalRecords } from "@/lib/analytics/prs";

export const metadata: Metadata = { title: "New Goal — Health" };

const EXERCISE_PICKER_SELECT = {
  id: true,
  name: true,
  equipment: true,
  primaryMuscles: true,
  isSystem: true,
} as const;

export default async function NewGoalPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [exercises, recentMetrics, prs] = await Promise.all([
    prisma.exercise.findMany({
      where: { OR: [{ ownerId: userId }, { isSystem: true }], isArchived: false },
      select: EXERCISE_PICKER_SELECT,
      orderBy: { name: "asc" },
    }),
    prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      distinct: ["type"],
      select: { type: true, value: true },
    }),
    getPersonalRecords(userId, prisma),
  ]);

  const latestMetricsByType = Object.fromEntries(recentMetrics.map((m) => [m.type, m.value]));

  const exercisePRs: Record<string, { estimatedOneRM?: number; topWeight?: number }> = {};
  for (const pr of prs) {
    if (!exercisePRs[pr.exerciseId]) exercisePRs[pr.exerciseId] = {};
    if (pr.prType === "estimatedOneRM") exercisePRs[pr.exerciseId].estimatedOneRM = pr.value;
    if (pr.prType === "topWeight") exercisePRs[pr.exerciseId].topWeight = pr.value;
  }

  return (
    <div>
      <PageHeader title="New Goal" />
      <GoalForm
        action={createGoalAction}
        availableExercises={exercises}
        unitPreference={session.user.unitPreference}
        latestMetricsByType={latestMetricsByType}
        exercisePRs={exercisePRs}
      />
    </div>
  );
}
