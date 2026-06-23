import { exerciseSchema, exerciseFilterSchema, cloneExerciseSchema } from "@/lib/validation/exercise";

const valid = {
  name: "Barbell Squat",
  equipment: "BARBELL",
  primaryMuscles: ["QUADS"],
  secondaryMuscles: [],
};

describe("exerciseSchema", () => {
  it("accepts a minimal valid exercise", () => {
    expect(exerciseSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const r = exerciseSchema.safeParse({
      ...valid,
      description: "A compound movement",
      instructions: "Step under bar...",
      commonPitfalls: "Don't round back.",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const r = exerciseSchema.safeParse({ ...valid, name: "" });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.name).toBeDefined();
  });

  it("rejects name longer than 120 chars", () => {
    const r = exerciseSchema.safeParse({ ...valid, name: "x".repeat(121) });
    expect(r.success).toBe(false);
  });

  it("rejects unknown equipment", () => {
    const r = exerciseSchema.safeParse({ ...valid, equipment: "TRAMPOLINE" });
    expect(r.success).toBe(false);
  });

  it("rejects empty primaryMuscles array", () => {
    const r = exerciseSchema.safeParse({ ...valid, primaryMuscles: [] });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.primaryMuscles).toBeDefined();
  });

  it("rejects unknown muscle group", () => {
    const r = exerciseSchema.safeParse({ ...valid, primaryMuscles: ["BRAIN"] });
    expect(r.success).toBe(false);
  });

  it("rejects instructions longer than 5000 chars", () => {
    const r = exerciseSchema.safeParse({ ...valid, instructions: "x".repeat(5001) });
    expect(r.success).toBe(false);
  });

  it("rejects commonPitfalls longer than 2000 chars", () => {
    const r = exerciseSchema.safeParse({ ...valid, commonPitfalls: "x".repeat(2001) });
    expect(r.success).toBe(false);
  });
});

describe("exerciseFilterSchema", () => {
  it("accepts empty filter (defaults)", () => {
    const r = exerciseFilterSchema.safeParse({});
    expect(r.success).toBe(true);
    expect(r.data?.scope).toBe("all");
  });

  it("accepts valid filter", () => {
    const r = exerciseFilterSchema.safeParse({ q: "bench", equipment: "BARBELL", muscle: "CHEST", scope: "mine" });
    expect(r.success).toBe(true);
  });

  it("rejects unknown scope", () => {
    const r = exerciseFilterSchema.safeParse({ scope: "theirs" });
    expect(r.success).toBe(false);
  });
});

describe("cloneExerciseSchema", () => {
  it("accepts just exerciseId", () => {
    expect(cloneExerciseSchema.safeParse({ exerciseId: "abc123" }).success).toBe(true);
  });

  it("accepts exerciseId with optional name", () => {
    expect(cloneExerciseSchema.safeParse({ exerciseId: "abc", name: "My Clone" }).success).toBe(true);
  });

  it("rejects empty exerciseId", () => {
    expect(cloneExerciseSchema.safeParse({ exerciseId: "" }).success).toBe(false);
  });
});
