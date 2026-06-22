"use client";

import { useState, useMemo } from "react";
import { useActionState } from "react";
import { completeOnboardingAction, OnboardingFormState } from "@/lib/actions/onboarding";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { UnitPreference } from "@/lib/constants";
import { weightUnitLabel } from "@/lib/units";

interface Props {
  unitPreference: UnitPreference;
}

export function OnboardingForm({ unitPreference }: Props) {
  const [state, formAction] = useActionState(completeOnboardingAction, {} as OnboardingFormState);
  const [showGoal, setShowGoal] = useState(false);
  const [goalType, setGoalType] = useState<"STRENGTH" | "BODY_METRIC" | "CONSISTENCY" | "">("");
  const [goalData, setGoalData] = useState<Record<string, any>>({});

  const unitLabel = weightUnitLabel(unitPreference);

  // Serialize goal into a hidden input value whenever state changes.
  // Empty string when goal section is hidden or no type selected.
  const goalJson = useMemo(() => {
    if (!showGoal || !goalType) return "";
    return JSON.stringify({
      type: goalType,
      title: goalData.title || "",
      targetDate: goalData.targetDate || null,
      status: "ACTIVE",
      config:
        goalType === "STRENGTH"
          ? {
              exerciseId: goalData.exerciseId || "",
              metric: goalData.strengthMetric || "1RM",
              targetValueKg: parseFloat(goalData.targetWeight || "0"),
            }
          : goalType === "BODY_METRIC"
            ? {
                metricType: goalData.metricType || "",
                targetValue: parseFloat(goalData.targetValue || "0"),
                direction: goalData.direction || "decrease",
              }
            : {
                workoutsPerWeek: parseInt(goalData.workoutsPerWeek || "0", 10),
              },
    });
  }, [showGoal, goalType, goalData]);

  return (
    <>
      <form action={formAction} className="space-y-6">
        {/* Hidden input carries the serialized goal config */}
        <input type="hidden" name="goal" value={goalJson} />

        <div>
          <h1 className="text-2xl font-bold text-foreground">Let's get set up</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Tell us a bit about yourself to personalize your experience.
          </p>
        </div>

        {state.error && (
          <div className="border border-danger/30 bg-danger/10 rounded-[var(--radius-app)] px-3 py-2 text-sm text-danger">
            {state.error}
          </div>
        )}

        {/* Initial bodyweight (optional) */}
        <fieldset className="space-y-3 border border-border rounded-[var(--radius-app)] p-4">
          <legend className="text-sm font-medium text-foreground px-1">
            Current weight (optional)
          </legend>
          <Field
            label={`Weight (${unitLabel})`}
            htmlFor="bodyweightKg"
            errors={state.fieldErrors?.bodyweightKg}
          >
            <Input
              id="bodyweightKg"
              type="number"
              name="bodyweightKg"
              placeholder="e.g. 75"
              step="0.1"
              inputMode="decimal"
            />
          </Field>
        </fieldset>

        {/* Goal section (optional) */}
        <fieldset className="space-y-3 border border-border rounded-[var(--radius-app)] p-4">
          <legend className="text-sm font-medium text-foreground px-1 flex items-center gap-2">
            <input
              type="checkbox"
              id="showGoal"
              checked={showGoal}
              onChange={(e) => {
                setShowGoal(e.target.checked);
                if (!e.target.checked) setGoalType("");
              }}
              className="rounded border-border"
            />
            <label htmlFor="showGoal">Set a first goal (optional)</label>
          </legend>

          {showGoal && (
            <div className="space-y-3 mt-3 pt-3 border-t border-border">
              <div>
                <label className="text-sm font-medium text-foreground">Goal type</label>
                <div className="space-y-2 mt-2">
                  {[
                    { value: "STRENGTH", label: "Strength" },
                    { value: "BODY_METRIC", label: "Body Metric" },
                    { value: "CONSISTENCY", label: "Consistency" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value={opt.value}
                        checked={goalType === opt.value}
                        onChange={(e) => {
                          setGoalType(e.target.value as any);
                          setGoalData({});
                        }}
                        className="rounded-full"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {goalType && (
                <>
                  <Field label="Goal title" htmlFor="goalTitle">
                    <Input
                      id="goalTitle"
                      type="text"
                      placeholder="e.g. Bench press 100kg"
                      value={goalData.title || ""}
                      onChange={(e) => setGoalData({ ...goalData, title: e.target.value })}
                    />
                  </Field>

                  {goalType === "STRENGTH" && (
                    <>
                      <Field label="Exercise name" htmlFor="exerciseName">
                        <Input
                          id="exerciseName"
                          type="text"
                          placeholder="e.g. Bench Press"
                          value={goalData.exerciseId || ""}
                          onChange={(e) => setGoalData({ ...goalData, exerciseId: e.target.value })}
                        />
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
                      <Field label={`Target weight (${unitLabel})`} htmlFor="targetWeight">
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
                      <Field label="Metric to track" htmlFor="metricType">
                        <select
                          id="metricType"
                          value={goalData.metricType || ""}
                          onChange={(e) => setGoalData({ ...goalData, metricType: e.target.value })}
                          className="h-11 w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">Select a metric</option>
                          {["BODYWEIGHT","WAIST","HIPS","CHEST","ARM_LEFT","ARM_RIGHT","THIGH_LEFT","THIGH_RIGHT","CALF","NECK","BODY_FAT_PCT"].map((t) => (
                            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Target value" htmlFor="targetValue">
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
                    <Field label="Workouts per week" htmlFor="workoutsPerWeek">
                      <Input
                        id="workoutsPerWeek"
                        type="number"
                        placeholder="e.g. 4"
                        min="1"
                        max="7"
                        value={goalData.workoutsPerWeek || ""}
                        onChange={(e) => setGoalData({ ...goalData, workoutsPerWeek: e.target.value })}
                      />
                    </Field>
                  )}

                  <Field label="Target date (optional)" htmlFor="goalTargetDate">
                    <Input
                      id="goalTargetDate"
                      type="date"
                      value={goalData.targetDate || ""}
                      onChange={(e) => setGoalData({ ...goalData, targetDate: e.target.value })}
                    />
                  </Field>
                </>
              )}
            </div>
          )}
        </fieldset>

        {/* Buttons */}
        <div className="space-y-2">
          <SubmitButton>Get started</SubmitButton>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          You can edit your profile and goals anytime in the settings.
        </p>
      </form>

      {/* Skip is a separate form so it never includes goal data */}
      <form action={formAction} className="mt-2">
        <button
          type="submit"
          className="w-full h-11 rounded-[var(--radius-app)] bg-surface border border-border px-4 font-medium text-foreground transition-colors hover:bg-muted"
        >
          Skip for now
        </button>
      </form>
    </>
  );
}
