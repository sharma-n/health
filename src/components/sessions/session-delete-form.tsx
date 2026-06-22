"use client";

import { useActionState } from "react";
import { deleteSessionAction, type SessionFormState } from "@/lib/actions/session";

export function SessionDeleteForm({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState<SessionFormState, FormData>(
    deleteSessionAction,
    {},
  );

  async function handleDelete(formData: FormData) {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    action(formData);
  }

  return (
    <div className="mt-6 space-y-3">
      {state.error && (
        <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <form action={handleDelete}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 font-medium text-danger transition-colors hover:bg-danger/20"
        >
          Delete session
        </button>
      </form>
    </div>
  );
}
