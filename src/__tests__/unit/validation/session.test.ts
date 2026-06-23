import {
  startSessionSchema,
  upsertSetSchema,
  setRestSchema,
  completeSessionSchema,
} from "@/lib/validation/session";

describe("startSessionSchema", () => {
  it("accepts all nulls (ad-hoc session)", () => {
    expect(startSessionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts with workoutId", () => {
    expect(startSessionSchema.safeParse({ workoutId: "w1" }).success).toBe(true);
  });

  it("accepts with planId and scheduledDate", () => {
    const r = startSessionSchema.safeParse({
      planId: "p1",
      scheduledDate: new Date("2026-07-01"),
    });
    expect(r.success).toBe(true);
  });
});

describe("upsertSetSchema", () => {
  const valid = {
    sessionExerciseId: "se-1",
    setNumber: 1,
    completed: false,
  };

  it("accepts a minimal set", () => {
    expect(upsertSetSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a full set with all fields", () => {
    const r = upsertSetSchema.safeParse({
      ...valid,
      id: "set-1",
      weightKg: 100,
      reps: 5,
      completed: true,
      restSeconds: 90,
      durationSeconds: 30,
    });
    expect(r.success).toBe(true);
  });

  it("rejects setNumber of 0", () => {
    expect(upsertSetSchema.safeParse({ ...valid, setNumber: 0 }).success).toBe(false);
  });

  it("rejects negative weightKg", () => {
    expect(upsertSetSchema.safeParse({ ...valid, weightKg: -1 }).success).toBe(false);
  });

  it("rejects negative reps", () => {
    expect(upsertSetSchema.safeParse({ ...valid, reps: -1 }).success).toBe(false);
  });

  it("rejects empty sessionExerciseId", () => {
    expect(upsertSetSchema.safeParse({ ...valid, sessionExerciseId: "" }).success).toBe(false);
  });
});

describe("setRestSchema", () => {
  it("accepts valid setId and restSeconds", () => {
    expect(setRestSchema.safeParse({ setId: "s1", restSeconds: 60 }).success).toBe(true);
  });

  it("accepts zero restSeconds", () => {
    expect(setRestSchema.safeParse({ setId: "s1", restSeconds: 0 }).success).toBe(true);
  });

  it("rejects negative restSeconds", () => {
    expect(setRestSchema.safeParse({ setId: "s1", restSeconds: -1 }).success).toBe(false);
  });
});

describe("completeSessionSchema", () => {
  it("accepts sessionId only", () => {
    expect(completeSessionSchema.safeParse({ sessionId: "s1" }).success).toBe(true);
  });

  it("accepts all fields", () => {
    const r = completeSessionSchema.safeParse({
      sessionId: "s1",
      overallEffort: 8,
      notes: "Great session",
    });
    expect(r.success).toBe(true);
  });

  it("rejects overallEffort below 1", () => {
    expect(completeSessionSchema.safeParse({ sessionId: "s1", overallEffort: 0 }).success).toBe(false);
  });

  it("rejects overallEffort above 10", () => {
    expect(completeSessionSchema.safeParse({ sessionId: "s1", overallEffort: 11 }).success).toBe(false);
  });

  it("rejects notes longer than 2000 chars", () => {
    expect(
      completeSessionSchema.safeParse({ sessionId: "s1", notes: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});
