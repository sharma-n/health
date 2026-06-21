"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { MuscleGroup } from "@/lib/constants";

type AvailableExercise = {
  id: string;
  name: string;
  equipment: string;
  primaryMuscles: unknown;
  isSystem: boolean;
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

function parseMuscles(raw: unknown): MuscleGroup[] {
  if (Array.isArray(raw)) return raw as MuscleGroup[];
  return [];
}

export function ExercisePicker({
  isOpen,
  onClose,
  onSelect,
  availableExercises,
  addedExerciseIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: AvailableExercise) => void;
  availableExercises: AvailableExercise[];
  addedExerciseIds: Set<string>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return availableExercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      const notAdded = !addedExerciseIds.has(ex.id);
      return matchesSearch && notAdded;
    });
  }, [search, availableExercises, addedExerciseIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-t-[var(--radius-app)] sm:rounded-[var(--radius-app)] bg-background p-4 max-h-96 flex flex-col">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">Add Exercise</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <ul className="overflow-y-auto space-y-1 flex-1">
          {filtered.length === 0 ? (
            <li className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No exercises found</p>
            </li>
          ) : (
            filtered.map((ex) => {
              const muscles = parseMuscles(ex.primaryMuscles);
              return (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(ex);
                      setSearch("");
                    }}
                    className="w-full text-left rounded-md border border-border bg-surface p-3 transition-colors hover:border-primary/40 hover:bg-surface-muted active:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-foreground">{ex.name}</span>
                      {ex.isSystem && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                          System
                        </span>
                      )}
                    </div>
                    {muscles.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {muscles.slice(0, 2).map((m) => MUSCLE_LABELS[m]).join(", ")}
                        {muscles.length > 2 && ` +${muscles.length - 2}`}
                      </p>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
