import { describe, it, expect } from "vitest";
import { getSupersetIndices, getNextInSuperset } from "@/components/sessions/session-logger";

type ExerciseState = {
  seId: string;
  exerciseId: string;
  name: string;
  supersetGroup: string | null;
  slots: { id: string | null; setNumber: number; weightInput: string; repsInput: string; completed: boolean; saving: boolean }[];
};

function makeExercise(name: string, supersetGroup: string | null, completedSets: number): ExerciseState {
  return {
    seId: name,
    exerciseId: name,
    name,
    supersetGroup,
    slots: Array.from({ length: Math.max(completedSets, 1) }, (_, i) => ({
      id: null,
      setNumber: i + 1,
      weightInput: "",
      repsInput: "",
      completed: i < completedSets,
      saving: false,
    })),
  };
}

describe("getSupersetIndices", () => {
  it("returns null for exercise with no supersetGroup", () => {
    const exercises = [makeExercise("Bench", null, 0), makeExercise("Row", "A", 0)];
    expect(getSupersetIndices(exercises, 0)).toBeNull();
  });

  it("returns indices of all exercises in the same group", () => {
    const exercises = [
      makeExercise("Bench", "A", 0),
      makeExercise("Squat", null, 0),
      makeExercise("Row", "A", 0),
    ];
    expect(getSupersetIndices(exercises, 0)).toEqual([0, 2]);
    expect(getSupersetIndices(exercises, 2)).toEqual([0, 2]);
  });

  it("returns null if currentIdx is out of bounds", () => {
    const exercises = [makeExercise("Bench", "A", 0)];
    expect(getSupersetIndices(exercises, 5)).toBeNull();
  });

  it("handles multiple distinct groups", () => {
    const exercises = [
      makeExercise("A1", "A", 0),
      makeExercise("B1", "B", 0),
      makeExercise("A2", "A", 0),
      makeExercise("B2", "B", 0),
    ];
    expect(getSupersetIndices(exercises, 0)).toEqual([0, 2]);
    expect(getSupersetIndices(exercises, 1)).toEqual([1, 3]);
  });
});

describe("getNextInSuperset", () => {
  it("returns next exercise that needs a set (simple 2-exercise case)", () => {
    const exercises = [makeExercise("Bench", "A", 0), makeExercise("Row", "A", 0)];
    // Bench just completed set 1 (willHaveCompleted=1), Row has 0 → Row needs a set
    expect(getNextInSuperset([0, 1], exercises, 1, 0)).toBe(1);
  });

  it("returns null when all exercises in the group are caught up (full round done)", () => {
    const exercises = [makeExercise("Bench", "A", 1), makeExercise("Row", "A", 0)];
    // Row (idx=1) just completed set 1 (willHaveCompleted=1). Bench has 1 done → 1 < 1 is false.
    expect(getNextInSuperset([0, 1], exercises, 1, 1)).toBeNull();
  });

  it("wraps around past the end (last exercise → first)", () => {
    const exercises = [
      makeExercise("A", "X", 0),
      makeExercise("B", "X", 0),
      makeExercise("C", "X", 0),
    ];
    // C (idx=2) just completed set 1. After=[], before=[0,1]. A has 0 done → return 0.
    expect(getNextInSuperset([0, 1, 2], exercises, 1, 2)).toBe(0);
  });

  it("skips exercises that already have enough sets done", () => {
    const exercises = [
      makeExercise("A", "X", 2),
      makeExercise("B", "X", 1),
      makeExercise("C", "X", 1),
    ];
    // A (idx=0) is completing its 3rd set (willHaveCompleted=3).
    // B has 1, C has 1 → both need a set → return B (idx=1, comes after A)
    expect(getNextInSuperset([0, 1, 2], exercises, 3, 0)).toBe(1);
  });

  it("advances through all exercises in round-robin order", () => {
    const exercises = [
      makeExercise("A", "X", 0),
      makeExercise("B", "X", 0),
      makeExercise("C", "X", 0),
    ];
    // A done (1): next is B
    expect(getNextInSuperset([0, 1, 2], exercises, 1, 0)).toBe(1);

    // B done (1): next is C (A already has 0 which is < 1, but C comes first when going after B)
    // after B(1): [2], before B(1): [0] → check C first (0 < 1 → true) → return 2
    expect(getNextInSuperset([0, 1, 2], exercises, 1, 1)).toBe(2);

    // C done (1): after=[none], before=[0,1] → A has 0 < 1 → return 0
    expect(getNextInSuperset([0, 1, 2], exercises, 1, 2)).toBe(0);
  });

  it("excludes currentIdx from consideration", () => {
    const exercises = [makeExercise("Solo", "X", 0)];
    // Only exercise in group: no next possible
    expect(getNextInSuperset([0], exercises, 1, 0)).toBeNull();
  });
});
