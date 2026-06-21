"use client";

import { useActionState, useState } from "react";
import { Check, AlertCircle } from "lucide-react";

import { updateProfileAction } from "@/lib/actions/auth";
import type { UnitPreference } from "@/lib/constants";

type ProfileEditorProps = {
  displayName: string;
  unitPreference: UnitPreference;
};

export function ProfileEditor({
  displayName: initialDisplayName,
  unitPreference: initialUnitPreference,
}: ProfileEditorProps) {
  const [state, formAction] = useActionState(updateProfileAction, {});
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [unitPreference, setUnitPreference] = useState<UnitPreference>(initialUnitPreference);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 flex gap-2 items-start">
          <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{state.error}</p>
        </div>
      )}

      {state.success && (
        <div className="rounded-[var(--radius-app)] border border-success/30 bg-success/10 px-4 py-3 flex gap-2 items-start">
          <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <p className="text-sm text-success">Profile updated successfully.</p>
        </div>
      )}

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-2">
          Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          className="w-full h-11 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        {state.fieldErrors?.displayName && (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.displayName[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="unitPreference" className="block text-sm font-medium text-foreground mb-2">
          Weight Unit
        </label>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 flex-1 cursor-pointer">
            <input
              type="radio"
              name="unitPreference"
              value="KG"
              checked={unitPreference === "KG"}
              onChange={() => setUnitPreference("KG")}
              className="h-4 w-4 cursor-pointer"
            />
            <span className="text-sm text-foreground">Kilograms (kg)</span>
          </label>
          <label className="flex items-center gap-2 flex-1 cursor-pointer">
            <input
              type="radio"
              name="unitPreference"
              value="LBS"
              checked={unitPreference === "LBS"}
              onChange={() => setUnitPreference("LBS")}
              className="h-4 w-4 cursor-pointer"
            />
            <span className="text-sm text-foreground">Pounds (lbs)</span>
          </label>
        </div>
        {state.fieldErrors?.unitPreference && (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.unitPreference[0]}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full h-11 rounded-[var(--radius-app)] bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Save changes
      </button>
    </form>
  );
}
