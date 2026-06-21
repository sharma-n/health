"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

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
  onUpdate: (updates: Partial<WorkoutExerciseRowProps>) => void;
  onRemove: () => void;
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
  onUpdate,
  onRemove,
}: WorkoutExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const SUPERSET_COLORS = [
    { border: "border-l-blue-400", bg: "bg-blue-500/10" },
    { border: "border-l-green-400", bg: "bg-green-500/10" },
    { border: "border-l-purple-400", bg: "bg-purple-500/10" },
    { border: "border-l-orange-400", bg: "bg-orange-500/10" },
    { border: "border-l-pink-400", bg: "bg-pink-500/10" },
    { border: "border-l-cyan-400", bg: "bg-cyan-500/10" },
  ];

  const getColor = (group: string) => {
    if (!group) return { border: "border-l-border", bg: "bg-surface-muted" };
    const hash = group.charCodeAt(0) + (group.charCodeAt(group.length - 1) || 0);
    return SUPERSET_COLORS[hash % SUPERSET_COLORS.length];
  };

  const color = getColor(supersetGroup);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border-l-4 p-3 ${color.border} ${color.bg}`}
    >
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <p className="font-medium text-foreground">{name}</p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center text-muted-foreground hover:text-danger transition-colors shrink-0"
          title="Remove exercise"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium">Sets</label>
          <input
            type="number"
            min="0"
            value={targetSets}
            onChange={(e) => onUpdate({ targetSets: e.target.value })}
            placeholder="—"
            className="mt-1 w-full h-10 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">Reps</label>
          <input
            type="number"
            min="0"
            value={targetReps}
            onChange={(e) => onUpdate({ targetReps: e.target.value })}
            placeholder="—"
            className="mt-1 w-full h-10 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">{weightUnit}</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={targetWeightDisplay}
            onChange={(e) => onUpdate({ targetWeightDisplay: e.target.value })}
            placeholder="—"
            className="mt-1 w-full h-10 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">Rest (s)</label>
          <input
            type="number"
            min="0"
            value={restSeconds}
            onChange={(e) => onUpdate({ restSeconds: e.target.value })}
            placeholder="—"
            className="mt-1 w-full h-10 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {supersetGroup && (
        <div className="mb-2 inline-block">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Superset {supersetGroup}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <label htmlFor={`superset-${id}`} className="text-xs text-muted-foreground font-medium">
            Superset Group (e.g. A, B)
          </label>
          <input
            id={`superset-${id}`}
            type="text"
            maxLength={50}
            value={supersetGroup}
            onChange={(e) => onUpdate({ supersetGroup: e.target.value })}
            placeholder="Leave blank for non-superset"
            className="mt-1 w-full h-10 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label htmlFor={`notes-${id}`} className="text-xs text-muted-foreground font-medium">
            Notes
          </label>
          <textarea
            id={`notes-${id}`}
            value={notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            maxLength={1000}
            placeholder="Optional form cues or adjustments..."
            className="mt-1 w-full h-20 rounded-md border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
