"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { BodyMetricFormState } from "@/lib/actions/body-metric";
import { BODY_METRIC_TYPES, UnitPreference } from "@/lib/constants";
import { weightUnitLabel, lengthUnitLabel } from "@/lib/units";

interface Props {
  action: (state: BodyMetricFormState, formData: FormData) => Promise<BodyMetricFormState>;
  unitPreference: UnitPreference;
}

function getMetricLabel(type: string, unitPreference: UnitPreference): string {
  if (type === "BODY_FAT_PCT") return "%";
  if (type === "BODYWEIGHT") return weightUnitLabel(unitPreference);
  return lengthUnitLabel(unitPreference);
}

export function MetricLogForm({ action, unitPreference }: Props) {
  const [state, formAction] = useActionState(action, {} as BodyMetricFormState);

  // Default to today
  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="max-w-md space-y-4">
      {state.error && (
        <div className="border border-danger/30 bg-danger/10 rounded-[var(--radius-app)] px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Field label="Measurement type" htmlFor="type" errors={state.fieldErrors?.type}>
        <select
          id="type"
          name="type"
          className="h-11 w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Select a type</option>
          {BODY_METRIC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Date" htmlFor="date" errors={state.fieldErrors?.date}>
        <Input id="date" type="date" name="date" defaultValue={today} />
      </Field>

      <Field
        label="Value"
        htmlFor="value"
        errors={state.fieldErrors?.value}
      >
        <Input
          id="value"
          type="number"
          name="value"
          placeholder="e.g. 75.5"
          step="0.1"
          inputMode="decimal"
        />
      </Field>

      <Field
        label="Note (optional)"
        htmlFor="note"
        errors={state.fieldErrors?.note}
      >
        <textarea
          id="note"
          name="note"
          placeholder="e.g. Measured in morning"
          rows={3}
          className="w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </Field>

      <SubmitButton>Log Measurement</SubmitButton>
    </form>
  );
}
