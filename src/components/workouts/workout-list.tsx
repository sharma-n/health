import Link from "next/link";
import { Dumbbell } from "lucide-react";

import { WorkoutCard, type WorkoutListItem } from "./workout-card";

export function WorkoutList({ workouts }: { workouts: WorkoutListItem[] }) {
  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-app)] border border-dashed border-border bg-surface px-6 py-12 text-center">
        <Dumbbell className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No workouts yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first workout template to get started.
        </p>
        <Link
          href="/workouts/new"
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Create workout
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {workouts.map((workout) => (
        <li key={workout.id}>
          <WorkoutCard workout={workout} />
        </li>
      ))}
    </ul>
  );
}
