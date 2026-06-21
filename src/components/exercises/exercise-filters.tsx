"use client";

import { useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from "@/lib/constants";
import type { ExerciseFilter } from "@/lib/validation/exercise";

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

export function ExerciseFilters({ defaultValues }: { defaultValues: ExerciseFilter }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`/exercises?${params.toString()}`);
    },
    [router, searchParams],
  );

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", value), 300);
  }

  const scopePills: { value: ExerciseFilter["scope"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: "mine", label: "Mine" },
    { value: "system", label: "Library" },
  ];

  return (
    <div className="mb-4 space-y-3">
      <input
        type="search"
        placeholder="Search exercises…"
        defaultValue={defaultValues.q}
        onChange={handleSearch}
        className="h-10 w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 gap-1 rounded-[var(--radius-app)] border border-border bg-surface p-1">
          {scopePills.map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => updateParam("scope", pill.value === "all" ? "" : pill.value)}
              className={`rounded-[calc(var(--radius-app)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
                defaultValues.scope === pill.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <select
          defaultValue={defaultValues.equipment ?? ""}
          onChange={(e) => updateParam("equipment", e.target.value)}
          className="h-9 shrink-0 rounded-[var(--radius-app)] border border-border bg-surface px-2 text-xs text-foreground outline-none transition-colors focus:border-primary"
        >
          <option value="">All equipment</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {EQUIPMENT_LABELS[eq]}
            </option>
          ))}
        </select>

        <select
          defaultValue={defaultValues.muscle ?? ""}
          onChange={(e) => updateParam("muscle", e.target.value)}
          className="h-9 shrink-0 rounded-[var(--radius-app)] border border-border bg-surface px-2 text-xs text-foreground outline-none transition-colors focus:border-primary"
        >
          <option value="">All muscles</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
