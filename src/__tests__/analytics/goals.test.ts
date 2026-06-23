import { computeGoalProgress } from "@/lib/analytics/goals";
import type { PrismaClient } from "@/generated/prisma/client";

function makePrisma(overrides: object): PrismaClient {
  return overrides as unknown as PrismaClient;
}

describe("computeGoalProgress — STRENGTH / 1RM (Epley formula)", () => {
  it("computes 1RM: 100kg × (1 + 5/30) = 116.67", async () => {
    const prisma = makePrisma({
      sessionSet: { findMany: vi.fn().mockResolvedValue([{ weightKg: 100, reps: 5 }]) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "STRENGTH", config: { exerciseId: "ex", metric: "1RM", targetValueKg: 150 } },
      prisma,
    );
    expect(r.current).toBeCloseTo(116.67, 1);
    expect(r.target).toBe(150);
    expect(r.unit).toBe("kg");
    expect(r.percentage).toBeCloseTo((116.67 / 150) * 100, 0);
  });

  it("picks the maximum 1RM estimate across all sets", async () => {
    // Set A: 80kg × (1+10/30) = 106.67
    // Set B: 100kg × (1+3/30) = 110.0  ← winner
    // Set C: 90kg × (1+8/30) = 114.0   ← actually winner
    const prisma = makePrisma({
      sessionSet: {
        findMany: vi.fn().mockResolvedValue([
          { weightKg: 80, reps: 10 },
          { weightKg: 100, reps: 3 },
          { weightKg: 90, reps: 8 },
        ]),
      },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "STRENGTH", config: { exerciseId: "ex", metric: "1RM", targetValueKg: 120 } },
      prisma,
    );
    // 90 × (1 + 8/30) = 90 × 1.2667 = 114
    expect(r.current).toBeCloseTo(114, 0);
  });

  it("returns current: null and percentage: 0 when no sets exist", async () => {
    const prisma = makePrisma({
      sessionSet: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "STRENGTH", config: { exerciseId: "ex", metric: "1RM", targetValueKg: 100 } },
      prisma,
    );
    expect(r.current).toBeNull();
    expect(r.percentage).toBe(0);
  });

  it("caps percentage at 100 when current exceeds target", async () => {
    const prisma = makePrisma({
      sessionSet: { findMany: vi.fn().mockResolvedValue([{ weightKg: 200, reps: 1 }]) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "STRENGTH", config: { exerciseId: "ex", metric: "1RM", targetValueKg: 100 } },
      prisma,
    );
    expect(r.percentage).toBe(100);
  });
});

describe("computeGoalProgress — STRENGTH / weightForReps", () => {
  it("finds best weight for the exact rep count", async () => {
    const prisma = makePrisma({
      sessionSet: {
        findMany: vi.fn().mockResolvedValue([
          { weightKg: 80, reps: 5 },
          { weightKg: 85, reps: 5 },
          { weightKg: 90, reps: 3 }, // different rep count — excluded
        ]),
      },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "STRENGTH", config: { exerciseId: "ex", metric: "weightForReps", targetValueKg: 100, reps: 5 } },
      prisma,
    );
    expect(r.current).toBe(85);
  });

  it("returns null when no sets match the rep count", async () => {
    const prisma = makePrisma({
      sessionSet: { findMany: vi.fn().mockResolvedValue([{ weightKg: 90, reps: 3 }]) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "STRENGTH", config: { exerciseId: "ex", metric: "weightForReps", targetValueKg: 100, reps: 5 } },
      prisma,
    );
    expect(r.current).toBeNull();
  });
});

describe("computeGoalProgress — BODY_METRIC", () => {
  it("computes percentage for an 'increase' direction goal", async () => {
    const prisma = makePrisma({
      bodyMetric: { findFirst: vi.fn().mockResolvedValue({ value: 75 }) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "BODY_METRIC", config: { metricType: "BODYWEIGHT", targetValue: 80, direction: "increase" } },
      prisma,
    );
    expect(r.current).toBe(75);
    expect(r.percentage).toBeCloseTo((75 / 80) * 100, 1);
    expect(r.unit).toBe("kg");
  });

  it("computes percentage for a 'decrease' direction goal (further = lower %)", async () => {
    const prisma = makePrisma({
      bodyMetric: { findFirst: vi.fn().mockResolvedValue({ value: 90 }) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "BODY_METRIC", config: { metricType: "BODYWEIGHT", targetValue: 80, direction: "decrease" } },
      prisma,
    );
    expect(r.percentage).toBeGreaterThan(0);
    expect(r.percentage).toBeLessThan(100);
  });

  it("returns 0 percentage when no metrics logged", async () => {
    const prisma = makePrisma({
      bodyMetric: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "BODY_METRIC", config: { metricType: "BODYWEIGHT", targetValue: 80, direction: "decrease" } },
      prisma,
    );
    expect(r.current).toBeNull();
    expect(r.percentage).toBe(0);
  });

  it("sets unit to '%' for BODY_FAT_PCT", async () => {
    const prisma = makePrisma({
      bodyMetric: { findFirst: vi.fn().mockResolvedValue({ value: 18 }) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "BODY_METRIC", config: { metricType: "BODY_FAT_PCT", targetValue: 15, direction: "decrease" } },
      prisma,
    );
    expect(r.unit).toBe("%");
  });

  it("sets unit to 'cm' for waist/hip/arm measurements", async () => {
    const prisma = makePrisma({
      bodyMetric: { findFirst: vi.fn().mockResolvedValue({ value: 85 }) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "BODY_METRIC", config: { metricType: "WAIST", targetValue: 80, direction: "decrease" } },
      prisma,
    );
    expect(r.unit).toBe("cm");
  });
});

describe("computeGoalProgress — CONSISTENCY", () => {
  it("calculates percentage based on completed sessions vs target", async () => {
    const prisma = makePrisma({
      session: { count: vi.fn().mockResolvedValue(8) },
    });
    const windowStart = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date();
    const r = await computeGoalProgress(
      { userId: "u", type: "CONSISTENCY", config: { workoutsPerWeek: 3, windowStart, windowEnd } },
      prisma,
    );
    // 4 weeks × 3/week = 12 target; 8/12 ≈ 66.7%
    expect(r.current).toBe(8);
    expect(r.unit).toBe("sessions");
    expect(r.percentage).toBeCloseTo(66.7, 0);
  });

  it("caps percentage at 100 when sessions exceed target", async () => {
    const prisma = makePrisma({
      session: { count: vi.fn().mockResolvedValue(99) },
    });
    const r = await computeGoalProgress(
      { userId: "u", type: "CONSISTENCY", config: { workoutsPerWeek: 1 } },
      prisma,
    );
    expect(r.percentage).toBe(100);
  });
});
