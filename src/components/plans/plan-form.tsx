"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { PlanFormState } from "@/lib/actions/plan";
import type { PlanStatus } from "@/lib/constants";

type AvailableWorkout = { id: string; name: string };

type DefaultValues = {
  planId?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  schedule: Array<{ dayOfWeek: number; workoutId: string }>;
};

const DAYS = [
  { label: "Sunday", short: "Sun", value: 0 },
  { label: "Monday", short: "Mon", value: 1 },
  { label: "Tuesday", short: "Tue", value: 2 },
  { label: "Wednesday", short: "Wed", value: 3 },
  { label: "Thursday", short: "Thu", value: 4 },
  { label: "Friday", short: "Fri", value: 5 },
  { label: "Saturday", short: "Sat", value: 6 },
];

const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function buildInitialSchedule(
  schedule: Array<{ dayOfWeek: number; workoutId: string }>,
): Record<number, string> {
  const map: Record<number, string> = {};
  for (const item of schedule) {
    map[item.dayOfWeek] = item.workoutId;
  }
  return map;
}

export function PlanForm({
  action,
  availableWorkouts,
  defaultValues,
}: {
  action: (prev: PlanFormState, formData: FormData) => Promise<PlanFormState>;
  availableWorkouts: AvailableWorkout[];
  defaultValues?: DefaultValues;
}) {
  const [state, formAction] = useActionState(action, {});

  const [name, setName] = useState(defaultValues?.name ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [startDate, setStartDate] = useState(defaultValues?.startDate ?? "");
  const [endDate, setEndDate] = useState(defaultValues?.endDate ?? "");
  const [schedule, setSchedule] = useState<Record<number, string>>(
    buildInitialSchedule(defaultValues?.schedule ?? []),
  );

  const handleScheduleChange = (dayOfWeek: number, workoutId: string) => {
    setSchedule((prev) => {
      const next = { ...prev };
      if (workoutId === "") {
        delete next[dayOfWeek];
      } else {
        next[dayOfWeek] = workoutId;
      }
      return next;
    });
  };

  const handleSubmit = async (formData: FormData) => {
    formData.set("name", name);
    if (description) formData.set("description", description);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);

    const scheduleArray = Object.entries(schedule).map(([day, workoutId]) => ({
      dayOfWeek: parseInt(day),
      workoutId,
    }));
    formData.set("schedule", JSON.stringify(scheduleArray));

    if (defaultValues?.planId) {
      formData.set("planId", defaultValues.planId);
    }

    await formAction(formData);
  };

  const isEdit = !!defaultValues?.planId;

  return (
    <form action={handleSubmit} className="max-w-2xl mx-auto space-y-5">
      {state.error && (
        <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
          Plan Name <span className="text-danger">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 12-Week Strength Block"
          className="w-full h-11 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-danger">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
          Description
        </label>
        <textarea
          id="description"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes about this plan's goals or structure..."
          className="w-full h-24 rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-2">
            Start date <span className="text-danger">*</span>
          </label>
          <input
            id="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full h-11 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {state.fieldErrors?.startDate && (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.startDate[0]}</p>
          )}
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-foreground mb-2">
            End date <span className="text-danger">*</span>
          </label>
          <input
            id="endDate"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full h-11 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {state.fieldErrors?.endDate && (
            <p className="mt-1 text-sm text-danger">{state.fieldErrors.endDate[0]}</p>
          )}
        </div>
      </div>

      {isEdit && (
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-foreground mb-2">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues?.status}
            className="w-full h-11 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            {(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as PlanStatus[]).map((s) => (
              <option key={s} value={s}>
                {PLAN_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="block text-sm font-medium text-foreground mb-3">Weekly Schedule</p>
        <p className="text-xs text-muted-foreground mb-3">
          Assign a workout to each day of the week. Leave days blank for rest.
        </p>
        <ul className="space-y-2">
          {DAYS.map((day) => (
            <li key={day.value} className="flex items-center gap-3">
              <span className="w-9 text-sm font-medium text-muted-foreground shrink-0">
                {day.short}
              </span>
              <select
                value={schedule[day.value] ?? ""}
                onChange={(e) => handleScheduleChange(day.value, e.target.value)}
                className="flex-1 h-10 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                aria-label={`${day.label} workout`}
              >
                <option value="">Rest day</option>
                {availableWorkouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        {availableWorkouts.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No workouts yet.{" "}
            <Link href="/workouts/new" className="underline text-primary">
              Create a workout
            </Link>{" "}
            first.
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full h-11 rounded-[var(--radius-app)] bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isEdit ? "Save changes" : "Create plan"}
      </button>
    </form>
  );
}
