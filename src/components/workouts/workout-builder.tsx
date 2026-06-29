"use client";

import { useActionState, useState, useMemo } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { toKg, weightUnitLabel } from "@/lib/units";
import type { UnitPreference } from "@/lib/constants";
import type { WorkoutFormState } from "@/lib/actions/workouts";
import type { WorkoutExerciseInput } from "@/lib/validation/workout";
import { ExercisePicker } from "./exercise-picker";
import { WorkoutExerciseRow } from "./workout-exercise-row";
import { SupersetGroupHeader } from "./superset-group-header";

type AvailableExercise = {
  id: string;
  name: string;
  equipment: string;
  primaryMuscles: unknown;
  secondaryMuscles: unknown;
  isSystem: boolean;
};

type BuilderExercise = WorkoutExerciseInput & {
  key: string;
  exerciseName: string;
  targetWeightDisplay: string;
};

type DefaultValues = {
  workoutId?: string;
  name: string;
  description?: string;
  notes?: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    order: number;
    targetSets?: string;
    targetReps?: string;
    targetWeightDisplay?: string;
    restSeconds?: string;
    supersetGroup?: string;
    notes?: string;
  }>;
};

function ActionFeedback({ state }: { state: WorkoutFormState }) {
  if (state.error) {
    return (
      <p className="rounded-[var(--radius-app)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  return null;
}

// Returns the next unused superset group letter (A, B, C…)
function getNextGroupName(exercises: BuilderExercise[]): string {
  const existing = new Set(exercises.map((ex) => ex.supersetGroup).filter(Boolean));
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (!existing.has(ch)) return ch;
  }
  return "A";
}

// Returns distinct superset groups in first-occurrence order
function getOrderedGroups(exercises: BuilderExercise[]): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const ex of exercises) {
    if (ex.supersetGroup && !seen.has(ex.supersetGroup)) {
      seen.add(ex.supersetGroup);
      groups.push(ex.supersetGroup);
    }
  }
  return groups;
}

export function WorkoutBuilder({
  action,
  availableExercises,
  unitPreference,
  defaultValues,
}: {
  action: (prev: WorkoutFormState, formData: FormData) => Promise<WorkoutFormState>;
  availableExercises: AvailableExercise[];
  unitPreference: UnitPreference;
  defaultValues?: DefaultValues;
}) {
  const [state, formAction] = useActionState(action, {});

  const weightUnit = weightUnitLabel(unitPreference);

  const initialExercises: BuilderExercise[] = defaultValues?.exercises.map(
    (ex, idx) => ({
      key: `ex-${idx}-${ex.exerciseId}`,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      order: idx,
      targetSets: parseInt(ex.targetSets ?? "") || null,
      targetReps: parseInt(ex.targetReps ?? "") || null,
      targetWeightKg: ex.targetWeightDisplay
        ? toKg(parseFloat(ex.targetWeightDisplay), unitPreference)
        : null,
      restSeconds: parseInt(ex.restSeconds ?? "") || null,
      supersetGroup: ex.supersetGroup ?? null,
      notes: ex.notes ?? null,
      targetWeightDisplay: ex.targetWeightDisplay ?? "",
    })
  ) ?? [];

  const [exercises, setExercises] = useState<BuilderExercise[]>(initialExercises);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");

  const addedExerciseIds = useMemo(
    () => new Set(exercises.map((ex) => ex.exerciseId)),
    [exercises]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = exercises.findIndex((ex) => ex.key === active.id);
      const newIndex = exercises.findIndex((ex) => ex.key === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setExercises(arrayMove(exercises, oldIndex, newIndex));
      }
    }
  };

  const handleAddExercise = (exercise: AvailableExercise) => {
    const newExercise: BuilderExercise = {
      key: `ex-${Date.now()}-${exercise.id}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      order: exercises.length,
      targetSets: null,
      targetReps: null,
      targetWeightKg: null,
      restSeconds: null,
      supersetGroup: null,
      notes: null,
      targetWeightDisplay: "",
    };
    setExercises([...exercises, newExercise]);
    setPickerOpen(false);
  };

  const handleUpdateExercise = (
    key: string,
    updates: Record<string, unknown>
  ) => {
    setExercises(
      exercises.map((ex) => {
        if (ex.key !== key) return ex;

        const converted: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (k === "targetSets" && v !== "") {
            converted[k] = parseInt(v as string) || null;
          } else if (k === "targetReps" && v !== "") {
            converted[k] = parseInt(v as string) || null;
          } else if (k === "restSeconds" && v !== "") {
            converted[k] = parseInt(v as string) || null;
          } else if (k === "targetWeightDisplay") {
            converted[k] = v;
          } else {
            converted[k] = v === "" ? null : v;
          }
        }

        const updated = { ...ex, ...converted } as BuilderExercise;

        if (converted.targetWeightDisplay !== undefined) {
          updated.targetWeightKg = (converted.targetWeightDisplay as string)
            ? toKg(parseFloat(converted.targetWeightDisplay as string), unitPreference)
            : null;
        }

        return updated;
      })
    );
  };

  const handleRemoveExercise = (key: string) => {
    setExercises(exercises.filter((ex) => ex.key !== key));
  };

  // Assign an exercise to a superset group; copies the group's existing restSeconds
  const handleGroupExercise = (key: string, groupName: string) => {
    setExercises((prev) => {
      const groupRest = prev.find((ex) => ex.supersetGroup === groupName)?.restSeconds ?? null;
      return prev.map((ex) =>
        ex.key === key ? { ...ex, supersetGroup: groupName, restSeconds: groupRest } : ex
      );
    });
  };

  // Remove a single exercise from its superset group
  const handleUngroupExercise = (key: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.key === key ? { ...ex, supersetGroup: null, restSeconds: null } : ex))
    );
  };

  // Clear supersetGroup from all exercises in the named group
  const handleDisbandGroup = (groupName: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.supersetGroup === groupName ? { ...ex, supersetGroup: null, restSeconds: null } : ex
      )
    );
  };

  // Sync restSeconds to every exercise in the superset group
  const handleUpdateSupersetRest = (groupName: string, restSeconds: number | null) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.supersetGroup === groupName ? { ...ex, restSeconds } : ex))
    );
  };

  const handleSubmit = async (formData: FormData) => {
    formData.set("name", name);
    formData.set("description", description);
    formData.set("notes", notes);

    const exercisesData: WorkoutExerciseInput[] = exercises.map((ex, idx) => ({
      exerciseId: ex.exerciseId,
      order: idx,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      targetWeightKg: ex.targetWeightKg,
      restSeconds: ex.restSeconds,
      supersetGroup: ex.supersetGroup,
      notes: ex.notes,
    }));
    formData.set("exercises", JSON.stringify(exercisesData));

    if (defaultValues?.workoutId) {
      formData.set("workoutId", defaultValues.workoutId);
    }

    await formAction(formData);
  };

  const exerciseKeys = exercises.map((ex) => ex.key);
  const seenGroups = new Set<string>();

  return (
    <form action={handleSubmit} className="max-w-2xl mx-auto space-y-5">
      <ActionFeedback state={state} />

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
          Workout Name <span className="text-danger">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day A"
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
          placeholder="Optional program notes or focus area..."
          className="w-full h-24 rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Exercises
        </label>

        {exercises.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={exerciseKeys} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {exercises.map((exercise) => {
                  const isFirstInGroup =
                    exercise.supersetGroup && !seenGroups.has(exercise.supersetGroup);
                  if (exercise.supersetGroup) seenGroups.add(exercise.supersetGroup);

                  // Groups available to join (all existing groups except this exercise's own)
                  const availableGroups = getOrderedGroups(exercises).filter(
                    (g) => g !== exercise.supersetGroup
                  );

                  return (
                    <li key={exercise.key} className="space-y-0">
                      {isFirstInGroup && exercise.supersetGroup && (
                        <SupersetGroupHeader
                          groupName={exercise.supersetGroup}
                          restSeconds={exercise.restSeconds ?? null}
                          onRestChange={(val) =>
                            handleUpdateSupersetRest(exercise.supersetGroup!, val)
                          }
                          onDisband={() => handleDisbandGroup(exercise.supersetGroup!)}
                        />
                      )}
                      <WorkoutExerciseRow
                        id={exercise.key}
                        name={exercise.exerciseName}
                        targetSets={exercise.targetSets?.toString() ?? ""}
                        targetReps={exercise.targetReps?.toString() ?? ""}
                        targetWeightDisplay={exercise.targetWeightDisplay}
                        restSeconds={exercise.restSeconds?.toString() ?? ""}
                        supersetGroup={exercise.supersetGroup ?? ""}
                        notes={exercise.notes ?? ""}
                        weightUnit={weightUnit}
                        availableGroups={availableGroups}
                        onUpdate={(updates) =>
                          handleUpdateExercise(exercise.key, updates as Record<string, unknown>)
                        }
                        onRemove={() => handleRemoveExercise(exercise.key)}
                        onGroup={(action, groupName) => {
                          const targetGroup =
                            action === "new"
                              ? getNextGroupName(exercises)
                              : (groupName ?? getNextGroupName(exercises));
                          handleGroupExercise(exercise.key, targetGroup);
                        }}
                        onUngroup={() => handleUngroupExercise(exercise.key)}
                      />
                    </li>
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="rounded-[var(--radius-app)] border-2 border-dashed border-border bg-surface/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">No exercises yet. Add one to get started.</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-3 flex h-10 items-center gap-1.5 rounded-[var(--radius-app)] border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-muted"
        >
          <Plus className="h-4 w-4" />
          Add exercise
        </button>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
          Notes
        </label>
        <textarea
          id="notes"
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional general notes for this workout..."
          className="w-full h-20 rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <button
        type="submit"
        className="w-full h-11 rounded-[var(--radius-app)] bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {defaultValues ? "Save changes" : "Create workout"}
      </button>

      <ExercisePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddExercise}
        availableExercises={availableExercises}
        addedExerciseIds={addedExerciseIds}
      />
    </form>
  );
}
