"use client";

import { useActionState } from "react";
import { setPlanStatusAction, type PlanFormState } from "@/lib/actions/plan";
import type { PlanStatus } from "@/lib/constants";

const initial: PlanFormState = {};

type Transition = { label: string; status: PlanStatus };

const TRANSITIONS: Record<PlanStatus, Transition[]> = {
  DRAFT: [{ label: "Activate", status: "ACTIVE" }],
  ACTIVE: [
    { label: "Mark complete", status: "COMPLETED" },
    { label: "Archive", status: "ARCHIVED" },
  ],
  COMPLETED: [{ label: "Archive", status: "ARCHIVED" }],
  ARCHIVED: [],
};

export function PlanStatusForm({
  planId,
  currentStatus,
}: {
  planId: string;
  currentStatus: PlanStatus;
}) {
  const [state, action] = useActionState(setPlanStatusAction, initial);
  const transitions = TRANSITIONS[currentStatus] ?? [];

  if (transitions.length === 0) return null;

  return (
    <div className="space-y-2">
      {state.error && (
        <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <form key={t.status} action={action}>
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="status" value={t.status} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-[var(--radius-app)] border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-muted"
            >
              {t.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
