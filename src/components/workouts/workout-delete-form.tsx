"use client";

import { useActionState } from "react";
import { deleteWorkoutAction, type WorkoutFormState } from "@/lib/actions/workouts";

const initial: WorkoutFormState = {};

function ActionFeedback({ state }: { state: WorkoutFormState }) {
  if (state.error) {
    return (
      <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  return null;
}

export function WorkoutDeleteForm({ workoutId }: { workoutId: string }) {
  const [state, action] = useActionState(deleteWorkoutAction, initial);

  const handleDelete = async (formData: FormData) => {
    if (!window.confirm("Delete this workout? This cannot be undone.")) {
      return;
    }
    action(formData);
  };

  return (
    <div className="mt-6 space-y-3">
      <ActionFeedback state={state} />
      <form action={handleDelete}>
        <input type="hidden" name="workoutId" value={workoutId} />
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 font-medium text-danger transition-colors hover:bg-danger/20"
        >
          Delete permanently
        </button>
      </form>
    </div>
  );
}
