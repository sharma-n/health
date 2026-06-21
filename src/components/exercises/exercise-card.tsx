import Link from "next/link";

import type { MuscleGroup, Equipment } from "@/lib/constants";

export type ExerciseListItem = {
  id: string;
  name: string;
  equipment: string;
  primaryMuscles: unknown;
  isSystem: boolean;
  isArchived: boolean;
  ownerId: string | null;
};

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

export function ExerciseCard({ exercise }: { exercise: ExerciseListItem }) {
  const muscles = parseMuscles(exercise.primaryMuscles);
  const displayMuscles = muscles.slice(0, 3);
  const remaining = muscles.length - displayMuscles.length;

  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className="block rounded-[var(--radius-app)] border border-border bg-surface p-4 transition-colors hover:border-primary/40 active:bg-surface-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground leading-snug">{exercise.name}</span>
        <div className="flex shrink-0 flex-wrap gap-1">
          {exercise.isSystem ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              System
            </span>
          ) : null}
          {exercise.isArchived ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Archived
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {EQUIPMENT_LABELS[exercise.equipment as Equipment] ?? exercise.equipment}
        </span>
        {displayMuscles.map((m) => (
          <span
            key={m}
            className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
          >
            {MUSCLE_LABELS[m] ?? m}
          </span>
        ))}
        {remaining > 0 ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            +{remaining} more
          </span>
        ) : null}
      </div>
    </Link>
  );
}
