"use client";

import { useActionState } from "react";
import { completeSessionAction, type SessionFormState } from "@/lib/actions/session";

type Props = {
  sessionId: string;
  onCancel: () => void;
};

export function SessionCompleteForm({ sessionId, onCancel }: Props) {
  const [state, action] = useActionState<SessionFormState, FormData>(
    completeSessionAction,
    {},
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-t-[var(--radius-app)] sm:rounded-[var(--radius-app)] bg-background p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Finish Session</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rate your effort and add any notes.
          </p>
        </div>

        {state.error && (
          <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="sessionId" value={sessionId} />

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Overall Effort (RPE)</p>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    name="overallEffort"
                    value={n}
                    className="peer sr-only"
                  />
                  <div className="flex flex-col items-center rounded-md border border-border bg-surface p-2 text-center transition-colors peer-checked:border-primary peer-checked:bg-primary/10 hover:border-primary/40">
                    <span className="text-sm font-semibold text-foreground">{n}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {/* Show label for selected — this is static, user reads the numbers */}
              1 = Very easy · 5 = Hard · 10 = All-out
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="session-notes"
              className="text-sm font-medium text-foreground"
            >
              Notes (optional)
            </label>
            <textarea
              id="session-notes"
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="How did it go?"
              className="w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-11 rounded-[var(--radius-app)] border border-border bg-surface font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-11 rounded-[var(--radius-app)] bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Finish Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
