import { Dumbbell } from "lucide-react";

import { ExerciseCard, type ExerciseListItem } from "./exercise-card";

export function ExerciseList({
  systemExercises,
  userExercises,
}: {
  systemExercises: ExerciseListItem[];
  userExercises: ExerciseListItem[];
}) {
  const isEmpty = systemExercises.length === 0 && userExercises.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-app)] border border-dashed border-border bg-surface px-6 py-12 text-center">
        <Dumbbell className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No exercises found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or add a new exercise.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {systemExercises.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Library ({systemExercises.length})
          </h2>
          <ul className="space-y-2">
            {systemExercises.map((ex) => (
              <li key={ex.id}>
                <ExerciseCard exercise={ex} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {userExercises.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            My Exercises ({userExercises.length})
          </h2>
          <ul className="space-y-2">
            {userExercises.map((ex) => (
              <li key={ex.id}>
                <ExerciseCard exercise={ex} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
