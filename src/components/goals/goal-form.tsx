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
  latestMetricsByType?: Record<string, number>;
  exercisePRs?: Record<string, { estimatedOneRM?: number; topWeight?: number }>;
}

export function GoalForm({
  action,
  availableExercises,
  defaultGoal,
  unitPreference,
  latestMetricsByType = {},
  exercisePRs = {},
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
            startingValueKg: parseFloat(goalData.startingValueKg || "0"),
          }),
        );
      } else if (goalType === "BODY_METRIC") {
        formData.append(
          "config",
          JSON.stringify({
            metricType: goalData.metricType || "",
            startingValue: parseFloat(goalData.startingValue || "0"),
            targetValue: parseFloat(goalData.targetValue || "0"),
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

  // When metric type changes, auto-populate starting value from latest logged metric
  function handleMetricTypeChange(newType: string) {
    const updates: Record<string, any> = { metricType: newType };
    if (latestMetricsByType[newType] !== undefined) {
      updates.startingValue = latestMetricsByType[newType].toString();
    }
    setGoalData((prev) => ({ ...prev, ...updates }));
  }

  // When exercise or strength metric changes, auto-populate starting value from PRs
  function handleStrengthFieldChange(field: "exerciseId" | "strengthMetric", value: string) {
    const updates: Record<string, any> = { [field]: value };
    const exId = field === "exerciseId" ? value : goalData.exerciseId;
    const metric = field === "strengthMetric" ? value : goalData.strengthMetric;
    if (exId && metric && exercisePRs[exId]) {
      const pr = exercisePRs[exId];
      const suggested = metric === "1RM" ? pr.estimatedOneRM : pr.topWeight;
      if (suggested !== undefined) {
        updates.startingValueKg = suggested.toFixed(1);
      }
    }
    setGoalData((prev) => ({ ...prev, ...updates }));
  }

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
                  onChange={(e) => handleStrengthFieldChange("exerciseId", e.target.value)}
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
                        onChange={(e) => handleStrengthFieldChange("strengthMetric", e.target.value)}
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
                label={`Starting Value (${unitLabel}) — your current best estimate`}
                htmlFor="startingValueKg"
                errors={state.fieldErrors?.["config.startingValueKg"]}
              >
                <Input
                  id="startingValueKg"
                  type="number"
                  placeholder="e.g. 80 (or 0 if unsure)"
                  step="0.1"
                  inputMode="decimal"
                  value={goalData.startingValueKg || ""}
                  onChange={(e) => setGoalData({ ...goalData, startingValueKg: e.target.value })}
                />
              </Field>

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
                  onChange={(e) => handleMetricTypeChange(e.target.value)}
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
                label="Starting Value"
                htmlFor="startingValue"
                errors={state.fieldErrors?.["config.startingValue"]}
              >
                <Input
                  id="startingValue"
                  type="number"
                  placeholder="e.g. 80"
                  step="0.1"
                  inputMode="decimal"
                  value={goalData.startingValue || ""}
                  onChange={(e) => setGoalData({ ...goalData, startingValue: e.target.value })}
                />
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

              {goalData.startingValue && goalData.targetValue && (
                <p className="text-xs text-muted-foreground">
                  Direction:{" "}
                  {parseFloat(goalData.targetValue) > parseFloat(goalData.startingValue)
                    ? "increase ↑"
                    : parseFloat(goalData.targetValue) < parseFloat(goalData.startingValue)
                      ? "decrease ↓"
                      : "no change"}
                </p>
              )}
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
