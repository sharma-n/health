"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Link2, Link2Off, X } from "lucide-react";
import { getSupersetColor } from "@/lib/superset-color";

type WorkoutExerciseRowUpdate = {
  targetSets?: string;
  targetReps?: string;
  targetWeightDisplay?: string;
  restSeconds?: string;
  notes?: string;
};

type WorkoutExerciseRowProps = {
  id: string;
  name: string;
  targetSets: string;
  targetReps: string;
  targetWeightDisplay: string;
  restSeconds: string;
  supersetGroup: string;
  notes: string;
  weightUnit: string;
  availableGroups: string[];
  onUpdate: (updates: WorkoutExerciseRowUpdate) => void;
  onRemove: () => void;
  onGroup: (action: "new" | "join", groupName?: string) => void;
  onUngroup: () => void;
};

export function WorkoutExerciseRow({
  id,
  name,
  targetSets,
  targetReps,
  targetWeightDisplay,
  restSeconds,
  supersetGroup,
  notes,
  weightUnit,
  availableGroups,
  onUpdate,
  onRemove,
  onGroup,
  onUngroup,
}: WorkoutExerciseRowProps) {
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = getSupersetColor(supersetGroup || null);
  const isInSuperset = Boolean(supersetGroup);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border-l-4 p-3 ${color.border} ${color.bg}`}
    >
      {/* Header row: drag handle + name + remove */}
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <p className="font-medium text-foreground">{name}</p>
          {isInSuperset && (
            <button
              type="button"
              onClick={onUngroup}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-danger"
            >
              <Link2Off className="h-3 w-3" />
              Remove from group
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-danger"
          title="Remove exercise"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Sets / Reps / Weight (/ Rest if not in superset) */}
      <div className={`mb-3 grid gap-2 ${isInSuperset ? "grid-cols-3" : "grid-cols-4"}`}>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Sets</label>
          <input
            type="number"
            min="0"
            value={targetSets}
            onChange={(e) => onUpdate({ targetSets: e.target.value })}
            placeholder="—"
            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Reps</label>
          <input
            type="number"
            min="0"
            value={targetReps}
            onChange={(e) => onUpdate({ targetReps: e.target.value })}
            placeholder="—"
            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{weightUnit}</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={targetWeightDisplay}
            onChange={(e) => onUpdate({ targetWeightDisplay: e.target.value })}
            placeholder="—"
            className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {!isInSuperset && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Rest (s)</label>
            <input
              type="number"
              min="0"
              value={restSeconds}
              onChange={(e) => onUpdate({ restSeconds: e.target.value })}
              placeholder="—"
              className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mb-3">
        <label htmlFor={`notes-${id}`} className="text-xs font-medium text-muted-foreground">
          Notes
        </label>
        <textarea
          id={`notes-${id}`}
          value={notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          maxLength={1000}
          placeholder="Optional form cues or adjustments..."
          className="mt-1 h-20 w-full resize-none rounded-md border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Superset grouping controls (only shown when not already in a group) */}
      {!isInSuperset && (
        <div>
          {groupMenuOpen ? (
            <div className="rounded-md border border-border bg-surface p-2 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onGroup("new");
                  setGroupMenuOpen(false);
                }}
                className="w-full rounded px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-muted"
              >
                Start new superset
              </button>
              {availableGroups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    onGroup("join", g);
                    setGroupMenuOpen(false);
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-muted"
                >
                  Add to Superset {g}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setGroupMenuOpen(false)}
                className="w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setGroupMenuOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Link2 className="h-3.5 w-3.5" />
              Add to superset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
