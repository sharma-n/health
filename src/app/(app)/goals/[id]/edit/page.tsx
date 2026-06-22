import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { GoalForm } from "@/components/goals/goal-form";
import { updateGoalAction } from "@/lib/actions/goal";

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

  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ ownerId: userId }, { isSystem: true }],
      isArchived: false,
    },
    select: EXERCISE_PICKER_SELECT,
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Edit Goal" />
      <GoalForm
        action={updateGoalAction}
        availableExercises={exercises}
        defaultGoal={goal}
        unitPreference={session.user.unitPreference}
      />
    </div>
  );
}
