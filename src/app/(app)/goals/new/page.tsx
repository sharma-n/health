import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { GoalForm } from "@/components/goals/goal-form";
import { createGoalAction } from "@/lib/actions/goal";

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
      <PageHeader title="New Goal" />
      <GoalForm action={createGoalAction} availableExercises={exercises} unitPreference={session.user.unitPreference} />
    </div>
  );
}
