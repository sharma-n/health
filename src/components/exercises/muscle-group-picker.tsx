"use client";

import { useState } from "react";

import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/constants";

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  CHEST: "Chest",
  BACK: "Back",
  SHOULDERS: "Shoulders",
  BICEPS: "Biceps",
  TRICEPS: "Triceps",
  FOREARMS: "Forearms",
  QUADS: "Quads",
  HAMSTRINGS: "Hamstrings",
  GLUTES: "Glutes",
  CALVES: "Calves",
  ABS: "Abs",
  OBLIQUES: "Obliques",
  TRAPS: "Traps",
  LATS: "Lats",
  NECK: "Neck",
  FULL_BODY: "Full Body",
};

export function MuscleGroupPicker({
  name,
  defaultValue = [],
  label,
  error,
}: {
  name: string;
  defaultValue?: MuscleGroup[];
  label: string;
  error?: string[];
}) {
  const [selected, setSelected] = useState<MuscleGroup[]>(defaultValue);

  function toggle(muscle: MuscleGroup) {
    setSelected((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      <div className="grid grid-cols-4 gap-1.5">
        {MUSCLE_GROUPS.map((muscle) => {
          const active = selected.includes(muscle);
          return (
            <button
              key={muscle}
              type="button"
              onClick={() => toggle(muscle)}
              className={`rounded-[var(--radius-app)] border px-2 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {MUSCLE_LABELS[muscle]}
            </button>
          );
        })}
      </div>
      {error?.length ? <p className="text-sm text-danger">{error[0]}</p> : null}
    </div>
  );
}
