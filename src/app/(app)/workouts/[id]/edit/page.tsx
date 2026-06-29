import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { WorkoutBuilder } from "@/components/workouts/workout-builder";
import { updateWorkoutAction } from "@/lib/actions/workouts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const workout = await prisma.workout.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: workout ? `Edit ${workout.name} — Health` : "Edit Workout — Health" };
}

const EXERCISE_PICKER_SELECT = {
  id: true,
  name: true,
  equipment: true,
  primaryMuscles: true,
  secondaryMuscles: true,
  isSystem: true,
} as const;

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { id } = await params;

  const workout = await prisma.workout.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      notes: true,
      ownerId: true,
      exercises: {
        select: {
          id: true,
          order: true,
          targetSets: true,
          targetReps: true,
          targetWeightKg: true,
          restSeconds: true,
          supersetGroup: true,
          notes: true,
          exercise: {
            select: {
              id: true,
              name: true,
              equipment: true,
              primaryMuscles: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!workout || workout.ownerId !== userId) notFound();

  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ ownerId: userId }, { isSystem: true }],
      isArchived: false,
    },
    select: EXERCISE_PICKER_SELECT,
    orderBy: { name: "asc" },
  });

  const unitPreference = session.user.unitPreference;
  const convertWeight = (kg: number | null): number | null => {
    if (kg === null) return null;
    return unitPreference === "KG" ? kg : Math.round(kg * 2.20462 * 10) / 10;
  };

  const defaultValues = {
    workoutId: workout.id,
    name: workout.name,
    description: workout.description ?? undefined,
    notes: workout.notes ?? undefined,
    exercises: workout.exercises.map((we) => ({
      exerciseId: we.exercise.id,
      exerciseName: we.exercise.name,
      order: we.order,
      targetSets: we.targetSets?.toString() ?? "",
      targetReps: we.targetReps?.toString() ?? "",
      targetWeightDisplay: we.targetWeightKg !== null ? convertWeight(we.targetWeightKg)?.toString() ?? "" : "",
      restSeconds: we.restSeconds?.toString() ?? "",
      supersetGroup: we.supersetGroup ?? "",
      notes: we.notes ?? "",
    })),
  };

  return (
    <div>
      <PageHeader title={`Edit: ${workout.name}`} />
      <WorkoutBuilder
        action={updateWorkoutAction}
        availableExercises={exercises}
        unitPreference={unitPreference}
        defaultValues={defaultValues}
      />
    </div>
  );
}
