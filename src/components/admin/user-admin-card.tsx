"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, RotateCcw, Trash2, ShieldCheck, ShieldOff } from "lucide-react";

import {
  changeUserPasswordAction,
  deleteUserAction,
  resetUserDataAction,
  setUserRoleAction,
  type AdminFormState,
} from "@/lib/actions/admin";
import { Field, Input } from "@/components/ui/field";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  createdAtLabel: string;
};

const initial: AdminFormState = {};

type Panel = "password" | "reset" | "delete" | null;

export function UserAdminCard({
  user,
  isSelf,
}: {
  user: AdminUser;
  isSelf: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <div className="rounded-[var(--radius-app)] border border-border bg-surface">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{user.displayName}</span>
            {user.isAdmin ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Admin
              </span>
            ) : null}
            {isSelf ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                You
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            Joined {user.createdAtLabel}
          </p>
        </div>
        <RoleToggle user={user} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2.5">
        <ActionTab
          active={panel === "password"}
          onClick={() => setPanel(panel === "password" ? null : "password")}
        >
          <KeyRound className="h-4 w-4" /> Password
        </ActionTab>
        <ActionTab
          active={panel === "reset"}
          onClick={() => setPanel(panel === "reset" ? null : "reset")}
        >
          <RotateCcw className="h-4 w-4" /> Reset data
        </ActionTab>
        {isSelf ? null : (
          <ActionTab
            danger
            active={panel === "delete"}
            onClick={() => setPanel(panel === "delete" ? null : "delete")}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </ActionTab>
        )}
      </div>

      {panel ? (
        <div className="border-t border-border px-4 py-3.5">
          {panel === "password" ? <PasswordForm userId={user.id} /> : null}
          {panel === "reset" ? (
            <ResetForm userId={user.id} name={user.displayName} />
          ) : null}
          {panel === "delete" ? (
            <DeleteForm userId={user.id} name={user.displayName} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActionTab({
  active,
  danger,
  onClick,
  children,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tone = danger
    ? "text-danger hover:bg-danger/10"
    : "text-foreground hover:bg-surface-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[var(--radius-app)] px-2.5 py-1.5 text-sm font-medium transition-colors ${tone} ${active ? "bg-surface-muted" : ""}`}
    >
      {children}
    </button>
  );
}

function Feedback({ state }: { state: AdminFormState }) {
  if (state.error) {
    return (
      <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-[var(--radius-app)] border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
        {state.success}
      </p>
    );
  }
  return null;
}

function Submit({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  const tone = danger
    ? "bg-danger text-white"
    : "bg-primary text-primary-foreground";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex h-10 items-center justify-center rounded-[var(--radius-app)] px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}

function RoleToggle({ user }: { user: AdminUser }) {
  const [state, formAction] = useActionState(setUserRoleAction, initial);
  return (
    <form action={formAction} className="shrink-0 text-right">
      <input type="hidden" name="userId" value={user.id} />
      <input
        type="hidden"
        name="makeAdmin"
        value={user.isAdmin ? "false" : "true"}
      />
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-[var(--radius-app)] border border-border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted"
      >
        {user.isAdmin ? (
          <>
            <ShieldOff className="h-4 w-4" /> Revoke admin
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" /> Make admin
          </>
        )}
      </button>
      {state.error ? (
        <p className="mt-1 max-w-48 text-xs text-danger">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="mt-1 max-w-48 text-xs text-muted-foreground">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

function PasswordForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(changeUserPasswordAction, initial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <Feedback state={state} />
      <Field
        label="New password"
        htmlFor={`np-${userId}`}
        errors={state.fieldErrors?.newPassword}
      >
        <Input
          id={`np-${userId}`}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
        />
      </Field>
      <Field
        label="Your admin password"
        htmlFor={`ap-pw-${userId}`}
        errors={state.fieldErrors?.adminPassword}
      >
        <Input
          id={`ap-pw-${userId}`}
          name="adminPassword"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Confirm it's you"
        />
      </Field>
      <Submit>Change password</Submit>
    </form>
  );
}

function ResetForm({ userId, name }: { userId: string; name: string }) {
  const [state, formAction] = useActionState(resetUserDataAction, initial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <Feedback state={state} />
      <p className="text-sm text-muted-foreground">
        Permanently erases all of {name}&apos;s workout data. The account itself
        is kept.
      </p>
      <Field
        label="Your admin password"
        htmlFor={`ap-rs-${userId}`}
        errors={state.fieldErrors?.adminPassword}
      >
        <Input
          id={`ap-rs-${userId}`}
          name="adminPassword"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Confirm it's you"
        />
      </Field>
      <Submit danger>Reset data</Submit>
    </form>
  );
}

function DeleteForm({ userId, name }: { userId: string; name: string }) {
  const [state, formAction] = useActionState(deleteUserAction, initial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <Feedback state={state} />
      <p className="text-sm text-muted-foreground">
        Permanently deletes {name}&apos;s account and all of their data. This
        can&apos;t be undone.
      </p>
      <Field
        label="Your admin password"
        htmlFor={`ap-del-${userId}`}
        errors={state.fieldErrors?.adminPassword}
      >
        <Input
          id={`ap-del-${userId}`}
          name="adminPassword"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Confirm it's you"
        />
      </Field>
      <Submit danger>Delete user</Submit>
    </form>
  );
}
