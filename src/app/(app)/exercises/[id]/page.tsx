import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { ExerciseActions } from "@/components/exercises/exercise-actions";
import type { Equipment, MuscleGroup } from "@/lib/constants";

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbell",
  MACHINE: "Machine",
  CABLE: "Cable",
  KETTLEBELL: "Kettlebell",
  BODYWEIGHT: "Bodyweight",
  BAND: "Band",
  OTHER: "Other",
};

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  BICEPS: "Biceps",
  TRICEPS: "Triceps",
  FOREARMS: "Forearms",
  QUADS: "Quads",
  HAMSTRINGS: "Hamstrings",
  GLUTES: "Glutes",
  CALVES: "Calves",
  ABS: "Abs",
  OBLIQUES: "Obliques",
  TRAPS: "Traps",
  LATS: "Lats",
  NECK: "Neck",
  FULL_BODY: "Full Body",
};

function parseMuscles(raw: unknown): MuscleGroup[] {
  if (Array.isArray(raw)) return raw as MuscleGroup[];
  return [];
}

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
  return { title: ex ? `${ex.name} — Health` : "Exercise — Health" };
}

export default async function ExerciseDetailPage({
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
      isArchived: true,
      ownerId: true,
      _count: { select: { workoutEntries: true, sessionEntries: true } },
    },
  });

  if (!exercise) notFound();
  if (!exercise.isSystem && exercise.ownerId !== userId) notFound();

  const primaryMuscles = parseMuscles(exercise.primaryMuscles);
  const secondaryMuscles = parseMuscles(exercise.secondaryMuscles);
  const hasRefs =
    exercise._count.workoutEntries > 0 || exercise._count.sessionEntries > 0;

  return (
    <div>
      <PageHeader title={exercise.name} />

      <div className="space-y-4">
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {exercise.isSystem ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                System exercise
              </span>
            ) : null}
            {exercise.isArchived ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            ) : null}
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {EQUIPMENT_LABELS[exercise.equipment as Equipment] ?? exercise.equipment}
            </span>
          </div>

          {exercise.description ? (
            <p className="text-sm text-muted-foreground">{exercise.description}</p>
          ) : null}

          {exercise.instructions ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Instructions
              </p>
              <p className="text-sm whitespace-pre-line text-foreground">{exercise.instructions}</p>
            </div>
          ) : null}

          {exercise.commonPitfalls ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Common Pitfalls
              </p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{exercise.commonPitfalls}</p>
            </div>
          ) : null}

          {primaryMuscles.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Primary muscles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {primaryMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
                  >
                    {MUSCLE_LABELS[m] ?? m}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {secondaryMuscles.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Secondary muscles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {secondaryMuscles.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {MUSCLE_LABELS[m] ?? m}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <ExerciseActions
          exercise={{
            id: exercise.id,
            isSystem: exercise.isSystem,
            isArchived: exercise.isArchived,
            ownerId: exercise.ownerId,
            hasRefs,
          }}
          userId={userId}
        />
      </div>
    </div>
  );
}
