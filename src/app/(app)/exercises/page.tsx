import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Suspense } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ExerciseList } from "@/components/exercises/exercise-list";
import { ExerciseFilters } from "@/components/exercises/exercise-filters";
import { exerciseFilterSchema, type ExerciseFilter } from "@/lib/validation/exercise";
import type { MuscleGroup } from "@/lib/constants";

export const metadata: Metadata = { title: "Exercises — Health" };

const EXERCISE_LIST_SELECT = {
  id: true,
  name: true,
  equipment: true,
  primaryMuscles: true,
  secondaryMuscles: true,
  isSystem: true,
  isArchived: true,
  ownerId: true,
} as const;

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const raw = await searchParams;
  const filterResult = exerciseFilterSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    equipment: typeof raw.equipment === "string" ? raw.equipment : undefined,
    muscle: typeof raw.muscle === "string" ? raw.muscle : undefined,
    scope: typeof raw.scope === "string" ? raw.scope : undefined,
  });
  const filter: ExerciseFilter = filterResult.success
    ? filterResult.data
    : { scope: "all" };

  const scopeWhere =
    filter.scope === "mine"
      ? [{ ownerId: userId, isArchived: false }]
      : filter.scope === "system"
        ? [{ isSystem: true }]
        : [{ ownerId: userId, isArchived: false }, { isSystem: true as const }];

  const allExercises = await prisma.exercise.findMany({
    where: {
      OR: scopeWhere,
      ...(filter.q ? { name: { contains: filter.q } } : {}),
      ...(filter.equipment ? { equipment: filter.equipment } : {}),
    },
    select: EXERCISE_LIST_SELECT,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }, { createdAt: "desc" }],
  });

  // Muscle filter applied in JS (SQLite JSON array contains not natively supported)
  const filtered = filter.muscle
    ? allExercises.filter((ex) => {
        const primary = Array.isArray(ex.primaryMuscles)
          ? (ex.primaryMuscles as MuscleGroup[])
          : [];
        const secondary = Array.isArray(ex.secondaryMuscles)
          ? (ex.secondaryMuscles as MuscleGroup[])
          : [];
        return primary.includes(filter.muscle!) || secondary.includes(filter.muscle!);
      })
    : allExercises;

  const systemExercises = filtered.filter((ex) => ex.isSystem);
  const userExercises = filtered.filter((ex) => !ex.isSystem);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exercises</h1>
          <p className="text-sm text-muted-foreground">
            Your library of movements, filterable by muscle and equipment.
          </p>
        </div>
        <Link
          href="/exercises/new"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      <Suspense>
        <ExerciseFilters defaultValues={filter} />
      </Suspense>

      <ExerciseList
        systemExercises={systemExercises}
        userExercises={userExercises}
      />
    </div>
  );
}
