"use client";

import { useActionState } from "react";
import { setGoalStatusAction, deleteGoalAction, GoalFormState } from "@/lib/actions/goal";

interface Props {
  goalId: string;
  currentStatus: string;
}

const TRANSITIONS: Record<string, { status: string; label: string; style: string }[]> = {
  ACTIVE: [
    { status: "ACHIEVED", label: "Mark Achieved", style: "bg-success text-white hover:opacity-90" },
    { status: "FAILED",   label: "Mark Failed",   style: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20" },
    { status: "ARCHIVED", label: "Archive",        style: "bg-muted text-muted-foreground hover:bg-muted/80" },
  ],
  ACHIEVED:  [{ status: "ACTIVE", label: "Reactivate", style: "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20" }],
  FAILED:    [{ status: "ACTIVE", label: "Reactivate", style: "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20" }],
  ARCHIVED:  [{ status: "ACTIVE", label: "Reactivate", style: "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20" }],
};

function StatusForm({ goalId, status, label, style }: { goalId: string; status: string; label: string; style: string }) {
  const [state, formAction] = useActionState(setGoalStatusAction, {} as GoalFormState);
  return (
    <form action={formAction}>
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="status" value={status} />
      {state.error && <p className="mb-1 text-xs text-danger">{state.error}</p>}
      <button type="submit" className={`w-full h-11 rounded-[var(--radius-app)] px-4 font-medium transition-colors ${style}`}>
        {label}
      </button>
    </form>
  );
}

function DeleteForm({ goalId }: { goalId: string }) {
  const [state, formAction] = useActionState(deleteGoalAction, {} as GoalFormState);
  return (
    <form action={formAction}>
      <input type="hidden" name="goalId" value={goalId} />
      {state.error && <p className="mb-1 text-xs text-danger">{state.error}</p>}
      <button
        type="submit"
        className="w-full h-11 rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 font-medium text-danger transition-colors hover:bg-danger/20"
      >
        Delete Goal
      </button>
    </form>
  );
}

export function GoalDetailActions({ goalId, currentStatus }: Props) {
  const transitions = TRANSITIONS[currentStatus] ?? [];

  return (
    <div className="space-y-2">
      {transitions.map((t) => (
        <StatusForm key={t.status} goalId={goalId} status={t.status} label={t.label} style={t.style} />
      ))}
      <div className="pt-2 border-t border-border">
        <DeleteForm goalId={goalId} />
      </div>
    </div>
  );
}
