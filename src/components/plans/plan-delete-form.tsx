"use client";

import { useActionState } from "react";
import { deletePlanAction, type PlanFormState } from "@/lib/actions/plan";

const initial: PlanFormState = {};

export function PlanDeleteForm({ planId }: { planId: string }) {
  const [state, action] = useActionState(deletePlanAction, initial);

  const handleDelete = async (formData: FormData) => {
    if (!window.confirm("Delete this plan? This cannot be undone.")) return;
    action(formData);
  };

  return (
    <div className="mt-6 space-y-3">
      {state.error && (
        <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <form action={handleDelete}>
        <input type="hidden" name="planId" value={planId} />
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 font-medium text-danger transition-colors hover:bg-danger/20"
        >
          Delete plan permanently
        </button>
      </form>
    </div>
  );
}
