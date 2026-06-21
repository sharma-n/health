"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { EQUIPMENT, type Equipment, type MuscleGroup } from "@/lib/constants";
import type { ExerciseFormState } from "@/lib/actions/exercises";
import { MuscleGroupPicker } from "./muscle-group-picker";

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbell",
  MACHINE: "Machine",
  CABLE: "Cable",
  KETTLEBELL: "Kettlebell",
  BODYWEIGHT: "Bodyweight",
  BAND: "Band",
  OTHER: "Other",
};

type Props = {
  action: (prev: ExerciseFormState, data: FormData) => Promise<ExerciseFormState>;
  defaultValues?: {
    exerciseId?: string;
    name?: string;
    description?: string;
    equipment?: Equipment;
    primaryMuscles?: MuscleGroup[];
    secondaryMuscles?: MuscleGroup[];
    instructions?: string;
    commonPitfalls?: string;
  };
  submitLabel: string;
};

export function ExerciseForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {defaultValues?.exerciseId ? (
        <input type="hidden" name="exerciseId" value={defaultValues.exerciseId} />
      ) : null}

      <Field label="Name" htmlFor="name" errors={state.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name}
          placeholder="e.g. Barbell Back Squat"
          required
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        errors={state.fieldErrors?.description}
      >
        <textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          rows={3}
          placeholder="Optional notes on form, cues, or variations…"
          className="w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </Field>

      <Field
        label="Instructions"
        htmlFor="instructions"
        errors={state.fieldErrors?.instructions}
      >
        <textarea
          id="instructions"
          name="instructions"
          defaultValue={defaultValues?.instructions}
          rows={5}
          placeholder="Step-by-step guide on how to perform this exercise…"
          className="w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </Field>

      <Field
        label="Common Pitfalls"
        htmlFor="commonPitfalls"
        errors={state.fieldErrors?.commonPitfalls}
      >
        <textarea
          id="commonPitfalls"
          name="commonPitfalls"
          defaultValue={defaultValues?.commonPitfalls}
          rows={4}
          placeholder="Typical beginner mistakes and how to avoid them…"
          className="w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </Field>

      <Field
        label="Equipment"
        htmlFor="equipment"
        errors={state.fieldErrors?.equipment}
      >
        <select
          id="equipment"
          name="equipment"
          defaultValue={defaultValues?.equipment ?? ""}
          className="h-11 w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="" disabled>
            Select equipment…
          </option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {EQUIPMENT_LABELS[eq]}
            </option>
          ))}
        </select>
      </Field>

      <MuscleGroupPicker
        name="primaryMuscles"
        label="Primary muscles"
        defaultValue={defaultValues?.primaryMuscles ?? []}
        error={state.fieldErrors?.primaryMuscles}
      />

      <MuscleGroupPicker
        name="secondaryMuscles"
        label="Secondary muscles (optional)"
        defaultValue={defaultValues?.secondaryMuscles ?? []}
        error={state.fieldErrors?.secondaryMuscles}
      />

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
