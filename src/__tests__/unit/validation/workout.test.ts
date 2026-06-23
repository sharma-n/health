import { workoutSchema, workoutExerciseSchema, reorderWorkoutExercisesSchema } from "@/lib/validation/workout";

describe("workoutExerciseSchema", () => {
  const valid = { exerciseId: "ex-1", order: 0 };

  it("accepts minimal valid exercise row", () => {
    expect(workoutExerciseSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all optional target fields", () => {
    const r = workoutExerciseSchema.safeParse({
      ...valid,
      targetSets: 3,
      targetReps: 5,
      targetWeightKg: 100,
      restSeconds: 90,
      supersetGroup: "A",
      notes: "Warm up first",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty exerciseId", () => {
    expect(workoutExerciseSchema.safeParse({ ...valid, exerciseId: "" }).success).toBe(false);
  });

  it("rejects negative order", () => {
    expect(workoutExerciseSchema.safeParse({ ...valid, order: -1 }).success).toBe(false);
  });

  it("rejects zero targetSets", () => {
    expect(workoutExerciseSchema.safeParse({ ...valid, targetSets: 0 }).success).toBe(false);
  });

  it("rejects negative targetWeightKg", () => {
    expect(workoutExerciseSchema.safeParse({ ...valid, targetWeightKg: -1 }).success).toBe(false);
  });
});

describe("workoutSchema", () => {
  it("accepts a workout with no exercises", () => {
    expect(workoutSchema.safeParse({ name: "Push Day" }).success).toBe(true);
  });

  it("accepts a workout with exercises", () => {
    const r = workoutSchema.safeParse({
      name: "Push Day",
      exercises: [{ exerciseId: "ex-1", order: 0, targetSets: 3 }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = workoutSchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.name).toBeDefined();
  });

  it("rejects name longer than 120 chars", () => {
    expect(workoutSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
  });
});

describe("reorderWorkoutExercisesSchema", () => {
  it("accepts workoutId and list of ids", () => {
    const r = reorderWorkoutExercisesSchema.safeParse({ workoutId: "w1", orderedIds: ["e1", "e2"] });
    expect(r.success).toBe(true);
  });

  it("accepts empty orderedIds", () => {
    expect(reorderWorkoutExercisesSchema.safeParse({ workoutId: "w1", orderedIds: [] }).success).toBe(true);
  });

  it("rejects empty workoutId", () => {
    expect(reorderWorkoutExercisesSchema.safeParse({ workoutId: "", orderedIds: [] }).success).toBe(false);
  });
});
