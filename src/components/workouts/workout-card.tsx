import Link from "next/link";

export type WorkoutListItem = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: {
    exercises: number;
  };
};

export function WorkoutCard({ workout }: { workout: WorkoutListItem }) {
  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="block rounded-[var(--radius-app)] border border-border bg-surface p-4 transition-colors hover:border-primary/40 active:bg-surface-muted"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground leading-snug">{workout.name}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground shrink-0">
          {workout._count.exercises} exercise{workout._count.exercises !== 1 ? "s" : ""}
        </span>
      </div>

      {workout.description ? (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {workout.description}
        </p>
      ) : null}
    </Link>
  );
}
