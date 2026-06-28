"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  upsertSetAction,
  setRestAction,
  addExerciseToSessionAction,
} from "@/lib/actions/session";
import { fromKg, toKg, weightUnitLabel } from "@/lib/units";
import type { UnitPreference } from "@/lib/constants";
import { ExercisePicker } from "@/components/workouts/exercise-picker";
import { RestTimer } from "@/components/sessions/rest-timer";
import { SessionCompleteForm } from "@/components/sessions/session-complete-form";
import { getSupersetColor } from "@/lib/superset-color";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AvailableExercise = {
  id: string;
  name: string;
  equipment: string;
  primaryMuscles: unknown;
  isSystem: boolean;
};

type SavedSet = {
  id: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  restSeconds: number | null;
  durationSeconds: number | null;
};

type SessionExercise = {
  id: string;
  exerciseId: string;
  order: number;
  exercise: { name: string };
  sets: SavedSet[];
};

type TemplateTarget = {
  exerciseId: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  restSeconds: number | null;
  notes: string | null;
  supersetGroup: string | null;
};

type SetSlot = {
  id: string | null;
  setNumber: number;
  weightInput: string;
  repsInput: string;
  completed: boolean;
  saving: boolean;
};

type ExerciseState = {
  seId: string;
  exerciseId: string;
  name: string;
  slots: SetSlot[];
  supersetGroup: string | null;
};

type RestTimerState = {
  active: boolean;
  totalSeconds: number;
  completedSetId: string | null;
  nextExerciseIdx: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildSlots(
  savedSets: SavedSet[],
  target: TemplateTarget | undefined,
  unit: UnitPreference,
): SetSlot[] {
  const targetCount = target?.targetSets ?? 0;
  const total = Math.max(savedSets.length, targetCount, 1);
  const slots: SetSlot[] = [];

  for (let i = 0; i < total; i++) {
    const saved = savedSets[i];
    if (saved) {
      slots.push({
        id: saved.id,
        setNumber: saved.setNumber,
        weightInput:
          saved.weightKg !== null
            ? round2(fromKg(saved.weightKg, unit)).toString()
            : target?.targetWeightKg != null
              ? round2(fromKg(target.targetWeightKg, unit)).toString()
              : "",
        repsInput:
          saved.reps !== null
            ? saved.reps.toString()
            : target?.targetReps != null
              ? target.targetReps.toString()
              : "",
        completed: saved.completed,
        saving: false,
      });
    } else {
      slots.push({
        id: null,
        setNumber: i + 1,
        weightInput:
          target?.targetWeightKg != null
            ? round2(fromKg(target.targetWeightKg, unit)).toString()
            : "",
        repsInput: target?.targetReps != null ? target.targetReps.toString() : "",
        completed: false,
        saving: false,
      });
    }
  }
  return slots;
}

function initExerciseState(
  exercises: SessionExercise[],
  targets: TemplateTarget[],
  unit: UnitPreference,
): ExerciseState[] {
  const targetMap = new Map(targets.map((t) => [t.exerciseId, t]));
  return exercises.map((ex) => ({
    seId: ex.id,
    exerciseId: ex.exerciseId,
    name: ex.exercise.name,
    slots: buildSlots(ex.sets, targetMap.get(ex.exerciseId), unit),
    supersetGroup: targetMap.get(ex.exerciseId)?.supersetGroup ?? null,
  }));
}

// Returns indices of all exercises sharing the same supersetGroup as exercises[currentIdx].
// Returns null if the current exercise has no group.
export function getSupersetIndices(
  exercises: ExerciseState[],
  currentIdx: number,
): number[] | null {
  const group = exercises[currentIdx]?.supersetGroup;
  if (!group) return null;
  return exercises.map((_, i) => i).filter((i) => exercises[i].supersetGroup === group);
}

// Among the superset indices, find the next exercise (after currentIdx, wrapping around)
// that has fewer completed sets than completedCount. Returns null if all are caught up.
export function getNextInSuperset(
  supersetIndices: number[],
  exercises: ExerciseState[],
  completedCount: number,
  currentIdx: number,
): number | null {
  // Search starting from exercises after currentIdx, then wrap to those before
  const after = supersetIndices.filter((i) => i > currentIdx);
  const before = supersetIndices.filter((i) => i < currentIdx);
  for (const idx of [...after, ...before]) {
    if (exercises[idx].slots.filter((s) => s.completed).length < completedCount) {
      return idx;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SessionLogger({
  session,
  workoutExercises,
  availableExercises,
  unitPreference,
}: {
  session: {
    id: string;
    startedAt: Date;
    workoutId: string | null;
    exercises: SessionExercise[];
  };
  workoutExercises: TemplateTarget[];
  availableExercises: AvailableExercise[];
  unitPreference: UnitPreference;
}) {
  const [exercises, setExercises] = useState<ExerciseState[]>(() =>
    initExerciseState(session.exercises, workoutExercises, unitPreference),
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [restTimer, setRestTimer] = useState<RestTimerState>({
    active: false,
    totalSeconds: 0,
    completedSetId: null,
    nextExerciseIdx: null,
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(session.startedAt);

  // Elapsed timer
  useEffect(() => {
    const update = () => {
      setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const current = exercises[currentIdx];
  const targetMap = new Map(workoutExercises.map((t) => [t.exerciseId, t]));
  const currentTarget = current ? targetMap.get(current.exerciseId) : undefined;
  const addedExerciseIds = new Set(exercises.map((e) => e.exerciseId));
  const unitLabel = weightUnitLabel(unitPreference);

  // Superset "Next" preview — what would auto-advance to after marking the next set done
  const supersetIndices = current ? getSupersetIndices(exercises, currentIdx) : null;
  const completedAfterMark = current
    ? current.slots.filter((s) => s.completed).length + 1
    : 0;
  const nextSupersetIdx =
    supersetIndices !== null
      ? getNextInSuperset(supersetIndices, exercises, completedAfterMark, currentIdx)
      : null;
  const nextInSupersetName =
    nextSupersetIdx !== null ? exercises[nextSupersetIdx].name : null;

  // ---- Slot mutation helpers ----

  function updateSlot(seIdx: number, slotIdx: number, patch: Partial<SetSlot>) {
    setExercises((prev) =>
      prev.map((ex, ei) =>
        ei !== seIdx
          ? ex
          : {
              ...ex,
              slots: ex.slots.map((s, si) =>
                si !== slotIdx ? s : { ...s, ...patch },
              ),
            },
      ),
    );
  }

  async function handleDoneSet(seIdx: number, slotIdx: number) {
    const ex = exercises[seIdx];
    const slot = ex.slots[slotIdx];
    if (!slot || slot.saving || slot.completed) return;

    const weightVal = parseFloat(slot.weightInput);
    const repsVal = parseInt(slot.repsInput, 10);
    const weightKg = slot.weightInput && !isNaN(weightVal) ? toKg(weightVal, unitPreference) : null;
    const reps = slot.repsInput && !isNaN(repsVal) ? repsVal : null;

    updateSlot(seIdx, slotIdx, { saving: true });

    const result = await upsertSetAction({
      id: slot.id ?? undefined,
      sessionExerciseId: ex.seId,
      setNumber: slot.setNumber,
      weightKg,
      reps,
      completed: true,
    });

    if (result.error || !result.setId) {
      updateSlot(seIdx, slotIdx, { saving: false });
      return;
    }

    updateSlot(seIdx, slotIdx, {
      id: result.setId,
      saving: false,
      completed: true,
    });

    const target = targetMap.get(ex.exerciseId);
    const willHaveCompleted = ex.slots.filter((s) => s.completed).length + 1;

    if (ex.supersetGroup) {
      const indices = getSupersetIndices(exercises, seIdx);
      const nextInRound =
        indices !== null
          ? getNextInSuperset(indices, exercises, willHaveCompleted, seIdx)
          : null;

      if (nextInRound !== null) {
        // More exercises need a set this round — auto-advance, no rest
        setCurrentIdx(nextInRound);
      } else {
        // Full round complete — check if every exercise in the group has finished all its slots
        const supersetFullyDone =
          indices !== null &&
          indices.every((idx) => {
            const exAtIdx = exercises[idx];
            const done =
              idx === seIdx
                ? willHaveCompleted
                : exAtIdx.slots.filter((s) => s.completed).length;
            return done >= exAtIdx.slots.length;
          });

        let nextTarget: number | null;
        if (supersetFullyDone) {
          // Advance past the superset entirely
          const maxIdx = indices ? Math.max(...indices) : seIdx;
          nextTarget = maxIdx + 1 < exercises.length ? maxIdx + 1 : null;
        } else {
          // More rounds to do — return to first exercise in the group
          nextTarget = indices ? indices[0] : null;
        }

        if (target?.restSeconds && target.restSeconds > 0) {
          setRestTimer({
            active: true,
            totalSeconds: target.restSeconds,
            completedSetId: result.setId,
            nextExerciseIdx: nextTarget,
          });
        } else if (nextTarget !== null) {
          setCurrentIdx(nextTarget);
        }
      }
    } else {
      // Non-superset: auto-advance to next exercise when all current slots are done
      const allDone = willHaveCompleted >= ex.slots.length;
      const nextExIdx = allDone && seIdx < exercises.length - 1 ? seIdx + 1 : null;

      if (target?.restSeconds && target.restSeconds > 0) {
        setRestTimer({
          active: true,
          totalSeconds: target.restSeconds,
          completedSetId: result.setId,
          nextExerciseIdx: nextExIdx,
        });
      } else if (nextExIdx !== null) {
        setCurrentIdx(nextExIdx);
      }
    }
  }

  function handleAddSlot(seIdx: number) {
    setExercises((prev) =>
      prev.map((ex, ei) => {
        if (ei !== seIdx) return ex;
        const lastSlot = ex.slots[ex.slots.length - 1];
        const target = targetMap.get(ex.exerciseId);
        return {
          ...ex,
          slots: [
            ...ex.slots,
            {
              id: null,
              setNumber: ex.slots.length + 1,
              weightInput: lastSlot?.weightInput ?? (target?.targetWeightKg != null ? round2(fromKg(target.targetWeightKg, unitPreference)).toString() : ""),
              repsInput: lastSlot?.repsInput ?? (target?.targetReps != null ? target.targetReps.toString() : ""),
              completed: false,
              saving: false,
            },
          ],
        };
      }),
    );
  }

  // ---- Rest timer handlers ----

  const handleRestComplete = useCallback(
    async (actualSeconds: number) => {
      const setId = restTimer.completedSetId;
      const advanceTo = restTimer.nextExerciseIdx;
      setRestTimer({ active: false, totalSeconds: 0, completedSetId: null, nextExerciseIdx: null });
      if (setId) await setRestAction(setId, actualSeconds);
      if (advanceTo !== null) setCurrentIdx(advanceTo);
    },
    [restTimer.completedSetId, restTimer.nextExerciseIdx],
  );

  const handleRestSkip = useCallback(
    async (actualSeconds: number) => {
      const setId = restTimer.completedSetId;
      const advanceTo = restTimer.nextExerciseIdx;
      setRestTimer({ active: false, totalSeconds: 0, completedSetId: null, nextExerciseIdx: null });
      if (setId) await setRestAction(setId, actualSeconds);
      if (advanceTo !== null) setCurrentIdx(advanceTo);
    },
    [restTimer.completedSetId, restTimer.nextExerciseIdx],
  );

  // ---- Add exercise ----

  async function handleAddExercise(exercise: AvailableExercise) {
    setPickerOpen(false);
    const result = await addExerciseToSessionAction(session.id, exercise.id);
    if (result.error || !result.sessionExerciseId) return;

    const newEx: ExerciseState = {
      seId: result.sessionExerciseId,
      exerciseId: exercise.id,
      name: exercise.name,
      supersetGroup: null,
      slots: [
        {
          id: null,
          setNumber: 1,
          weightInput: "",
          repsInput: "",
          completed: false,
          saving: false,
        },
      ],
    };
    setExercises((prev) => {
      const updated = [...prev, newEx];
      setCurrentIdx(updated.length - 1);
      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const supersetColor = current?.supersetGroup
    ? getSupersetColor(current.supersetGroup)
    : null;

  return (
    <div className="space-y-4 pb-24">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-[var(--radius-app)] border border-border bg-surface px-4 py-3">
        <p className="text-sm font-medium text-muted-foreground">Elapsed</p>
        <p className="font-mono text-lg font-semibold text-foreground tabular-nums">
          {formatElapsed(elapsed)}
        </p>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-[var(--radius-app)] border-2 border-dashed border-border bg-surface/50 p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No exercises yet. Add one to get started.</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Exercise
          </button>
        </div>
      ) : (
        <>
          {/* Exercise navigation */}
          <div
            className={`flex items-center gap-2 rounded-[var(--radius-app)] border-l-4 border border-border bg-surface px-3 py-3 ${supersetColor ? supersetColor.border : "border-l-transparent"} ${supersetColor ? supersetColor.bg : ""}`}
          >
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-app)] border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground">
                {currentIdx + 1} / {exercises.length}
              </p>
              <p className="font-semibold text-foreground">{current?.name}</p>
              {current?.supersetGroup && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium">Superset {current.supersetGroup}</span>
                  {nextInSupersetName && (
                    <span className="text-muted-foreground/70"> · Next: {nextInSupersetName}</span>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(exercises.length - 1, i + 1))}
              disabled={currentIdx === exercises.length - 1}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-app)] border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Template targets reference */}
          {currentTarget && (
            <div className="rounded-[var(--radius-app)] border border-border bg-surface-muted px-4 py-2">
              <p className="text-xs text-muted-foreground">
                Target:{" "}
                {[
                  currentTarget.targetSets && `${currentTarget.targetSets} sets`,
                  currentTarget.targetReps && `× ${currentTarget.targetReps} reps`,
                  currentTarget.targetWeightKg != null &&
                    `@ ${round2(fromKg(currentTarget.targetWeightKg, unitPreference))} ${unitLabel}`,
                  currentTarget.restSeconds &&
                    (current?.supersetGroup
                      ? `${currentTarget.restSeconds}s rest between rounds`
                      : `${currentTarget.restSeconds}s rest`),
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              {currentTarget.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">{currentTarget.notes}</p>
              )}
            </div>
          )}

          {/* Rest timer (shown when active, above set rows) */}
          {restTimer.active && (
            <RestTimer
              totalSeconds={restTimer.totalSeconds}
              onComplete={handleRestComplete}
              onSkip={handleRestSkip}
            />
          )}

          {/* Set rows */}
          <div className="rounded-[var(--radius-app)] border border-border bg-surface overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 border-b border-border px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground text-center">#</span>
              <span className="text-xs font-medium text-muted-foreground">{unitLabel}</span>
              <span className="text-xs font-medium text-muted-foreground">Reps</span>
              <span className="sr-only">Done</span>
            </div>

            {current?.slots.map((slot, si) => (
              <div
                key={si}
                className={`grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 items-center px-3 py-2 border-b last:border-b-0 border-border ${slot.completed ? "bg-emerald-500/5" : ""}`}
              >
                <span className="text-sm font-medium text-muted-foreground text-center">
                  {slot.setNumber}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={slot.weightInput}
                  onChange={(e) => updateSlot(currentIdx, si, { weightInput: e.target.value })}
                  disabled={slot.completed || slot.saving}
                  placeholder="—"
                  className="h-11 w-full rounded-md border border-border bg-background px-2 text-center text-base font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={slot.repsInput}
                  onChange={(e) => updateSlot(currentIdx, si, { repsInput: e.target.value })}
                  disabled={slot.completed || slot.saving}
                  placeholder="—"
                  className="h-11 w-full rounded-md border border-border bg-background px-2 text-center text-base font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
                <div className="flex items-center justify-center">
                  {slot.saving ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : slot.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDoneSet(currentIdx, si)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-600"
                      title="Mark set done"
                    >
                      <Circle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Set */}
          <button
            type="button"
            onClick={() => handleAddSlot(currentIdx)}
            className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-app)] border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Set
          </button>
        </>
      )}

      {/* Footer actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 h-11 rounded-[var(--radius-app)] border border-border bg-surface font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          <Plus className="h-4 w-4" />
          Add Exercise
        </button>
        <button
          type="button"
          onClick={() => setShowComplete(true)}
          className="flex flex-1 items-center justify-center h-11 rounded-[var(--radius-app)] bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Finish Session
        </button>
      </div>

      {/* Modals */}
      <ExercisePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddExercise}
        availableExercises={availableExercises}
        addedExerciseIds={addedExerciseIds}
      />

      {showComplete && (
        <SessionCompleteForm
          sessionId={session.id}
          onCancel={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
