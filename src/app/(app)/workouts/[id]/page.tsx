import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Edit, Play } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { WorkoutDeleteForm } from "@/components/workouts/workout-delete-form";
import { startSessionAction } from "@/lib/actions/session";
import type { MuscleGroup } from "@/lib/constants";
import { BodyMap } from "@/components/ui/body-map";

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

const SUPERSET_COLORS = [
  { border: "border-l-blue-400", bg: "bg-blue-500/10" },
  { border: "border-l-green-400", bg: "bg-green-500/10" },
  { border: "border-l-purple-400", bg: "bg-purple-500/10" },
  { border: "border-l-orange-400", bg: "bg-orange-500/10" },
  { border: "border-l-pink-400", bg: "bg-pink-500/10" },
  { border: "border-l-cyan-400", bg: "bg-cyan-500/10" },
];

function getSupersetColor(group: string | null): { border: string; bg: string } {
  if (!group) return { border: "border-l-border", bg: "bg-surface-muted" };
  const hash = group.charCodeAt(0) + (group.charCodeAt(group.length - 1) || 0);
  return SUPERSET_COLORS[hash % SUPERSET_COLORS.length];
}

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
  return { title: workout ? `${workout.name} — Health` : "Workout — Health" };
}

export default async function WorkoutDetailPage({
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

  const muscleCounts: Partial<Record<MuscleGroup, number>> = {};
  for (const we of workout.exercises) {
    const muscles = parseMuscles(we.exercise.primaryMuscles);
    for (const m of muscles) muscleCounts[m] = (muscleCounts[m] ?? 0) + 1;
  }

  const unitPreference = session.user.unitPreference;
  const weightUnit = unitPreference === "KG" ? "kg" : "lbs";
  const convertWeight = (kg: number | null): number | null => {
    if (kg === null) return null;
    return unitPreference === "KG" ? kg : Math.round(kg * 2.20462 * 10) / 10;
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <PageHeader title={workout.name} />
        <div className="flex shrink-0 items-center gap-2">
          <form action={startSessionAction}>
            <input type="hidden" name="workoutId" value={workout.id} />
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 rounded-[var(--radius-app)] bg-emerald-600 px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          </form>
          <Link
            href={`/workouts/${workout.id}/edit`}
            className="flex h-9 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {workout.description ? (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
            <p className="text-sm text-foreground">{workout.description}</p>
          </div>
        ) : null}

        {workout.exercises.length > 0 ? (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exercises ({workout.exercises.length})
            </p>
            <ul className="space-y-2">
              {workout.exercises.map((we) => {
                const primaryMuscles = parseMuscles(we.exercise.primaryMuscles);
                const color = getSupersetColor(we.supersetGroup);
                return (
                  <li
                    key={we.id}
                    className={`rounded-md border-l-4 p-3 ${color.border} ${color.bg}`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <Link
                          href={`/exercises/${we.exercise.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {we.exercise.name}
                        </Link>
                        {primaryMuscles.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}
                          </p>
                        )}
                      </div>
                      {we.supersetGroup && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Superset {we.supersetGroup}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {we.targetSets && (
                        <span>{we.targetSets} set{we.targetSets !== 1 ? "s" : ""}</span>
                      )}
                      {we.targetReps && (
                        <span>× {we.targetReps} reps</span>
                      )}
                      {we.targetWeightKg !== null && (
                        <span>@ {convertWeight(we.targetWeightKg)} {weightUnit}</span>
                      )}
                      {we.restSeconds && (
                        <span>{we.restSeconds}s rest</span>
                      )}
                    </div>
                    {we.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">{we.notes}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="rounded-[var(--radius-app)] border-2 border-dashed border-border bg-surface/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">No exercises in this workout.</p>
          </div>
        )}

        {Object.keys(muscleCounts).length > 0 && (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Muscles targeted
            </p>
            <BodyMap muscleIntensity={muscleCounts} />
          </div>
        )}

        {workout.notes ? (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </p>
            <p className="text-sm whitespace-pre-line text-foreground">{workout.notes}</p>
          </div>
        ) : null}

        <WorkoutDeleteForm workoutId={workout.id} />
      </div>
    </div>
  );
}
