import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { updateExerciseAction } from "@/lib/actions/exercises";
import type { Equipment, MuscleGroup } from "@/lib/constants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ex = await prisma.exercise.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: ex ? `Edit ${ex.name} — Health` : "Edit Exercise — Health" };
}

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { id } = await params;

  const exercise = await prisma.exercise.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      equipment: true,
      primaryMuscles: true,
      secondaryMuscles: true,
      instructions: true,
      commonPitfalls: true,
      isSystem: true,
      ownerId: true,
    },
  });

  if (!exercise) notFound();
  // System exercises cannot be edited directly — redirect to detail for clone flow
  if (exercise.isSystem) redirect(`/exercises/${id}`);
  if (exercise.ownerId !== userId) notFound();

  const primaryMuscles = Array.isArray(exercise.primaryMuscles)
    ? (exercise.primaryMuscles as MuscleGroup[])
    : [];
  const secondaryMuscles = Array.isArray(exercise.secondaryMuscles)
    ? (exercise.secondaryMuscles as MuscleGroup[])
    : [];

  return (
    <div>
      <PageHeader title={`Edit: ${exercise.name}`} />
      <ExerciseForm
        action={updateExerciseAction}
        defaultValues={{
          exerciseId: exercise.id,
          name: exercise.name,
          description: exercise.description ?? undefined,
          equipment: exercise.equipment as Equipment,
          primaryMuscles,
          secondaryMuscles,
          instructions: exercise.instructions ?? undefined,
          commonPitfalls: exercise.commonPitfalls ?? undefined,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
