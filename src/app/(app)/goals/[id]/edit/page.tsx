import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { GoalForm } from "@/components/goals/goal-form";
import { updateGoalAction } from "@/lib/actions/goal";
import { getPersonalRecords } from "@/lib/analytics/prs";

export const metadata: Metadata = { title: "Edit Goal — Health" };

const EXERCISE_PICKER_SELECT = {
  id: true,
  name: true,
  equipment: true,
  primaryMuscles: true,
  isSystem: true,
} as const;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditGoalPage(props: Props) {
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
      <PageHeader title="Edit Goal" />
      <GoalForm
        action={updateGoalAction}
        availableExercises={exercises}
        defaultGoal={goal}
        unitPreference={session.user.unitPreference}
        latestMetricsByType={latestMetricsByType}
        exercisePRs={exercisePRs}
      />
    </div>
  );
}
