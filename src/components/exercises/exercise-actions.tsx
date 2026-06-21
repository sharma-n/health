"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  archiveExerciseAction,
  cloneExerciseAction,
  deleteExerciseAction,
  unarchiveExerciseAction,
  type ExerciseFormState,
} from "@/lib/actions/exercises";

type ExerciseDetailItem = {
  id: string;
  isSystem: boolean;
  isArchived: boolean;
  ownerId: string | null;
  hasRefs: boolean;
};

const initial: ExerciseFormState = {};

function ActionFeedback({ state }: { state: ExerciseFormState }) {
  if (state.error) {
    return (
      <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-[var(--radius-app)] border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        {state.success}
      </p>
    );
  }
  return null;
}

export function ExerciseActions({
  exercise,
  userId,
}: {
  exercise: ExerciseDetailItem;
  userId: string;
}) {
  const [cloneState, cloneAction] = useActionState(cloneExerciseAction, initial);
  const [archiveState, archiveAction] = useActionState(archiveExerciseAction, initial);
  const [unarchiveState, unarchiveAction] = useActionState(unarchiveExerciseAction, initial);
  const [deleteState, deleteAction] = useActionState(deleteExerciseAction, initial);

  if (exercise.isSystem) {
    return (
      <div className="mt-6 space-y-3">
        <ActionFeedback state={cloneState} />
        <form action={cloneAction}>
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Clone &amp; Edit
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          System exercises are read-only. Cloning creates your own editable copy.
        </p>
      </div>
    );
  }

  if (exercise.ownerId !== userId) return null;

  return (
    <div className="mt-6 space-y-3">
      <ActionFeedback state={archiveState} />
      <ActionFeedback state={unarchiveState} />
      <ActionFeedback state={deleteState} />

      {!exercise.isArchived ? (
        <Link
          href={`/exercises/${exercise.id}/edit`}
          className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Edit
        </Link>
      ) : null}

      {!exercise.isArchived ? (
        <form action={archiveAction}>
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] border border-border bg-surface px-4 font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Archive
          </button>
        </form>
      ) : (
        <form action={unarchiveAction}>
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Restore from Archive
          </button>
        </form>
      )}

      {!exercise.hasRefs ? (
        <form action={deleteAction}>
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 font-medium text-danger transition-colors hover:bg-danger/20"
          >
            Delete permanently
          </button>
        </form>
      ) : null}
    </div>
  );
}
