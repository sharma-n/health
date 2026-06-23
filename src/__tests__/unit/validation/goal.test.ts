import { goalSchema, setGoalStatusSchema } from "@/lib/validation/goal";

describe("goalSchema — STRENGTH", () => {
  it("accepts a 1RM strength goal", () => {
    const r = goalSchema.safeParse({
      type: "STRENGTH",
      title: "Bench Press 100kg",
      config: { exerciseId: "ex-1", metric: "1RM", targetValueKg: 100 },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a weightForReps strength goal with reps", () => {
    const r = goalSchema.safeParse({
      type: "STRENGTH",
      title: "Squat 5 reps at 100kg",
      config: { exerciseId: "ex-1", metric: "weightForReps", targetValueKg: 100, reps: 5 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative targetValueKg", () => {
    const r = goalSchema.safeParse({
      type: "STRENGTH",
      title: "Bad",
      config: { exerciseId: "ex-1", metric: "1RM", targetValueKg: -10 },
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing exerciseId", () => {
    const r = goalSchema.safeParse({
      type: "STRENGTH",
      title: "Bad",
      config: { metric: "1RM", targetValueKg: 100 },
    });
    expect(r.success).toBe(false);
  });
});

describe("goalSchema — BODY_METRIC", () => {
  it("accepts a weight loss goal with startingValue + targetValue", () => {
    const r = goalSchema.safeParse({
      type: "BODY_METRIC",
      title: "Lose weight",
      config: { metricType: "BODYWEIGHT", startingValue: 80, targetValue: 75 },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a size increase goal", () => {
    const r = goalSchema.safeParse({
      type: "BODY_METRIC",
      title: "Build arms",
      config: { metricType: "ARM_LEFT", startingValue: 35, targetValue: 40 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown metricType", () => {
    const r = goalSchema.safeParse({
      type: "BODY_METRIC",
      title: "Bad",
      config: { metricType: "WINGSPAN", startingValue: 80, targetValue: 70 },
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing startingValue", () => {
    const r = goalSchema.safeParse({
      type: "BODY_METRIC",
      title: "Bad",
      config: { metricType: "BODYWEIGHT", targetValue: 75 },
    });
    expect(r.success).toBe(false);
  });
});

describe("goalSchema — CONSISTENCY", () => {
  it("accepts a simple consistency goal", () => {
    const r = goalSchema.safeParse({
      type: "CONSISTENCY",
      title: "Train 3x/week",
      config: { workoutsPerWeek: 3 },
    });
    expect(r.success).toBe(true);
  });

  it("accepts goal with window dates", () => {
    const r = goalSchema.safeParse({
      type: "CONSISTENCY",
      title: "Summer training",
      config: {
        workoutsPerWeek: 4,
        windowStart: new Date("2026-06-01"),
        windowEnd: new Date("2026-08-31"),
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects fractional workoutsPerWeek", () => {
    const r = goalSchema.safeParse({
      type: "CONSISTENCY",
      title: "Bad",
      config: { workoutsPerWeek: 2.5 },
    });
    expect(r.success).toBe(false);
  });
});

describe("goalSchema — general", () => {
  it("rejects an unknown type", () => {
    const r = goalSchema.safeParse({
      type: "UNKNOWN",
      title: "Bad",
      config: {},
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty title", () => {
    const r = goalSchema.safeParse({
      type: "CONSISTENCY",
      title: "",
      config: { workoutsPerWeek: 3 },
    });
    expect(r.success).toBe(false);
  });

  it("rejects STRENGTH config on BODY_METRIC type", () => {
    const r = goalSchema.safeParse({
      type: "BODY_METRIC",
      title: "Mismatch",
      config: { exerciseId: "ex-1", metric: "1RM", targetValueKg: 100 },
    });
    expect(r.success).toBe(false);
  });
});

describe("setGoalStatusSchema", () => {
  it("accepts valid goalId and status", () => {
    expect(setGoalStatusSchema.safeParse({ goalId: "g1", status: "ACHIEVED" }).success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(setGoalStatusSchema.safeParse({ goalId: "g1", status: "SMASHED" }).success).toBe(false);
  });
});
