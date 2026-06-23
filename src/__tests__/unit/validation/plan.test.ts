import { planSchema, setPlanStatusSchema, planScheduleItemSchema } from "@/lib/validation/plan";

describe("planSchema", () => {
  const start = new Date("2026-07-01");
  const end = new Date("2026-07-31");

  const valid = {
    name: "Summer Cut",
    startDate: start,
    endDate: end,
  };

  it("accepts a minimal valid plan", () => {
    expect(planSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults status to DRAFT", () => {
    const r = planSchema.safeParse(valid);
    expect(r.success && r.data.status).toBe("DRAFT");
  });

  it("accepts a schedule with items", () => {
    const r = planSchema.safeParse({
      ...valid,
      schedule: [
        { dayOfWeek: 1, workoutId: "w1" },
        { dayOfWeek: 3, workoutId: "w2" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects endDate before startDate", () => {
    const r = planSchema.safeParse({ ...valid, endDate: new Date("2026-06-30") });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.endDate).toBeDefined();
  });

  it("accepts endDate equal to startDate", () => {
    const r = planSchema.safeParse({ ...valid, endDate: start });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = planSchema.safeParse({ ...valid, name: "" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown status", () => {
    const r = planSchema.safeParse({ ...valid, status: "PAUSED" });
    expect(r.success).toBe(false);
  });
});

describe("planScheduleItemSchema", () => {
  it("accepts valid day and workout", () => {
    expect(planScheduleItemSchema.safeParse({ dayOfWeek: 0, workoutId: "w1" }).success).toBe(true);
    expect(planScheduleItemSchema.safeParse({ dayOfWeek: 6, workoutId: "w1" }).success).toBe(true);
  });

  it("rejects dayOfWeek < 0", () => {
    expect(planScheduleItemSchema.safeParse({ dayOfWeek: -1, workoutId: "w1" }).success).toBe(false);
  });

  it("rejects dayOfWeek > 6", () => {
    expect(planScheduleItemSchema.safeParse({ dayOfWeek: 7, workoutId: "w1" }).success).toBe(false);
  });

  it("rejects empty workoutId", () => {
    expect(planScheduleItemSchema.safeParse({ dayOfWeek: 1, workoutId: "" }).success).toBe(false);
  });
});

describe("setPlanStatusSchema", () => {
  it("accepts valid planId and ACTIVE status", () => {
    expect(setPlanStatusSchema.safeParse({ planId: "p1", status: "ACTIVE" }).success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(setPlanStatusSchema.safeParse({ planId: "p1", status: "RUNNING" }).success).toBe(false);
  });
});
