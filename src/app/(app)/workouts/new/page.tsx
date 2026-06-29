import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { WorkoutBuilder } from "@/components/workouts/workout-builder";
import { createWorkoutAction } from "@/lib/actions/workouts";

export const metadata: Metadata = { title: "New Workout — Health" };

const EXERCISE_PICKER_SELECT = {
  id: true,
  name: true,
  equipment: true,
  primaryMuscles: true,
  secondaryMuscles: true,
  isSystem: true,
} as const;

export default async function NewWorkoutPage() {
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
      <PageHeader title="New Workout" />
      <WorkoutBuilder
        action={createWorkoutAction}
        availableExercises={exercises}
        unitPreference={session.user.unitPreference}
      />
    </div>
  );
}
