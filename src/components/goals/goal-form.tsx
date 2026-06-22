"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { GoalFormState } from "@/lib/actions/goal";
import { BODY_METRIC_TYPES, UnitPreference } from "@/lib/constants";
import { weightUnitLabel } from "@/lib/units";

interface Exercise {
  id: string;
  name: string;
  equipment: string;
  primaryMuscles: any;
  isSystem: boolean;
}

interface GoalFormProps {
  action: (state: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  availableExercises: Exercise[];
  defaultGoal?: {
    id: string;
    type: string;
    title: string;
    targetDate: Date | null;
    status: string;
    config: any;
  };
  unitPreference: UnitPreference;
}

export function GoalForm({
  action,
  availableExercises,
  defaultGoal,
  unitPreference,
}: GoalFormProps) {
  const [state, formAction] = useActionState(action, {} as GoalFormState);
  const [goalType, setGoalType] = useState<"STRENGTH" | "BODY_METRIC" | "CONSISTENCY" | "">(
    (defaultGoal?.type as any) || "",
  );
  const [goalData, setGoalData] = useState<Record<string, any>>(
    defaultGoal
      ? {
          title: defaultGoal.title,
          targetDate: defaultGoal.targetDate
            ? new Date(defaultGoal.targetDate).toISOString().split("T")[0]
            : "",
          ...defaultGoal.config,
        }
      : {},
  );

  const handleFormSubmit = async (formData: FormData) => {
    if (defaultGoal) {
      formData.append("goalId", defaultGoal.id);
    }

    if (goalType) {
      formData.append("type", goalType);
      formData.append("title", goalData.title || "");
      formData.append("targetDate", goalData.targetDate || "");
      formData.append("status", goalData.status || "ACTIVE");

      if (goalType === "STRENGTH") {
        formData.append(
          "config",
          JSON.stringify({
            exerciseId: goalData.exerciseId || "",
            metric: goalData.strengthMetric || "1RM",
            targetValueKg: parseFloat(goalData.targetWeight || "0"),
            reps: goalData.reps ? parseInt(goalData.reps, 10) : undefined,
          }),
        );
      } else if (goalType === "BODY_METRIC") {
        formData.append(
          "config",
          JSON.stringify({
            metricType: goalData.metricType || "",
            targetValue: parseFloat(goalData.targetValue || "0"),
            direction: goalData.direction || "decrease",
          }),
        );
      } else if (goalType === "CONSISTENCY") {
        formData.append(
          "config",
          JSON.stringify({
            workoutsPerWeek: parseInt(goalData.workoutsPerWeek || "0", 10),
            windowStart: goalData.windowStart || undefined,
            windowEnd: goalData.windowEnd || undefined,
          }),
        );
      }
    }

    await formAction(formData);
  };

  const unitLabel = weightUnitLabel(unitPreference);

  return (
    <form action={handleFormSubmit} className="max-w-md space-y-4">
      {state.error && (
        <div className="border border-danger/30 bg-danger/10 rounded-[var(--radius-app)] px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Field label="Goal Type" htmlFor="goalType" errors={state.fieldErrors?.type}>
        <select
          id="goalType"
          value={goalType}
          onChange={(e) => {
            setGoalType(e.target.value as any);
            setGoalData({});
          }}
          className="h-11 w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Select a goal type</option>
          <option value="STRENGTH">Strength</option>
          <option value="BODY_METRIC">Body Metric</option>
          <option value="CONSISTENCY">Consistency</option>
        </select>
      </Field>

      {goalType && (
        <>
          <Field label="Goal Title" htmlFor="title" errors={state.fieldErrors?.["title"]}>
            <Input
              id="title"
              type="text"
              placeholder="e.g. Bench Press 100kg"
              value={goalData.title || ""}
              onChange={(e) => setGoalData({ ...goalData, title: e.target.value })}
            />
          </Field>

          {goalType === "STRENGTH" && (
            <>
              <Field label="Exercise" htmlFor="exerciseId" errors={state.fieldErrors?.["config.exerciseId"]}>
                <select
                  id="exerciseId"
                  value={goalData.exerciseId || ""}
                  onChange={(e) => setGoalData({ ...goalData, exerciseId: e.target.value })}
                  className="h-11 w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select an exercise</option>
                  {availableExercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <label className="text-sm font-medium text-foreground">Metric</label>
                <div className="space-y-2 mt-2">
                  {[
                    { value: "1RM", label: "1 Rep Max" },
                    { value: "weightForReps", label: "Weight for Reps" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value={opt.value}
                        checked={goalData.strengthMetric === opt.value}
                        onChange={(e) => setGoalData({ ...goalData, strengthMetric: e.target.value })}
                        className="rounded-full"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {goalData.strengthMetric === "weightForReps" && (
                <Field
                  label="Target Reps"
                  htmlFor="reps"
                  errors={state.fieldErrors?.["config.reps"]}
                >
                  <Input
                    id="reps"
                    type="number"
                    min="1"
                    placeholder="e.g. 5"
                    value={goalData.reps || ""}
                    onChange={(e) => setGoalData({ ...goalData, reps: e.target.value })}
                  />
                </Field>
              )}

              <Field
                label={`Target Weight (${unitLabel})`}
                htmlFor="targetWeight"
                errors={state.fieldErrors?.["config.targetValueKg"]}
              >
                <Input
                  id="targetWeight"
                  type="number"
                  placeholder="e.g. 100"
                  step="0.1"
                  inputMode="decimal"
                  value={goalData.targetWeight || ""}
                  onChange={(e) => setGoalData({ ...goalData, targetWeight: e.target.value })}
                />
              </Field>
            </>
          )}

          {goalType === "BODY_METRIC" && (
            <>
              <Field label="Metric Type" htmlFor="metricType" errors={state.fieldErrors?.["config.metricType"]}>
                <select
                  id="metricType"
                  value={goalData.metricType || ""}
                  onChange={(e) => setGoalData({ ...goalData, metricType: e.target.value })}
                  className="h-11 w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select a metric</option>
                  {BODY_METRIC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Target Value"
                htmlFor="targetValue"
                errors={state.fieldErrors?.["config.targetValue"]}
              >
                <Input
                  id="targetValue"
                  type="number"
                  placeholder="e.g. 75"
                  step="0.1"
                  inputMode="decimal"
                  value={goalData.targetValue || ""}
                  onChange={(e) => setGoalData({ ...goalData, targetValue: e.target.value })}
                />
              </Field>

              <div>
                <label className="text-sm font-medium text-foreground">Direction</label>
                <div className="space-y-2 mt-2">
                  {[
                    { value: "decrease", label: "Decrease" },
                    { value: "increase", label: "Increase" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value={opt.value}
                        checked={goalData.direction === opt.value}
                        onChange={(e) => setGoalData({ ...goalData, direction: e.target.value })}
                        className="rounded-full"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {goalType === "CONSISTENCY" && (
            <Field
              label="Workouts per Week"
              htmlFor="workoutsPerWeek"
              errors={state.fieldErrors?.["config.workoutsPerWeek"]}
            >
              <Input
                id="workoutsPerWeek"
                type="number"
                min="1"
                max="7"
                placeholder="e.g. 4"
                value={goalData.workoutsPerWeek || ""}
                onChange={(e) => setGoalData({ ...goalData, workoutsPerWeek: e.target.value })}
              />
            </Field>
          )}

          <Field
            label="Target Date (optional)"
            htmlFor="targetDate"
            errors={state.fieldErrors?.["targetDate"]}
          >
            <Input
              id="targetDate"
              type="date"
              value={goalData.targetDate || ""}
              onChange={(e) => setGoalData({ ...goalData, targetDate: e.target.value })}
            />
          </Field>

          <SubmitButton>{defaultGoal ? "Update Goal" : "Create Goal"}</SubmitButton>
        </>
      )}
    </form>
  );
}
