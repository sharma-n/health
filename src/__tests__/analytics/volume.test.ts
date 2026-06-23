import { getMuscleVolumeByWeek } from "@/lib/analytics/volume";
import type { PrismaClient } from "@/generated/prisma/client";

function makePrisma(sessionExercises: object[]): PrismaClient {
  return {
    sessionExercise: { findMany: vi.fn().mockResolvedValue(sessionExercises) },
  } as unknown as PrismaClient;
}

function thisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diff);
  mon.setUTCHours(10, 0, 0, 0);
  return mon;
}

describe("getMuscleVolumeByWeek", () => {
  it("returns N week buckets", async () => {
    const result = await getMuscleVolumeByWeek("u", makePrisma([]), 4);
    expect(result.weeks).toHaveLength(4);
    expect(result.muscleGroups).toHaveLength(0);
  });

  it("accumulates volume for an exercise done this week", async () => {
    const sessionExercises = [
      {
        session: { startedAt: thisMonday() },
        exercise: { primaryMuscles: ["QUADS"] },
        sets: [
          { weightKg: 100, reps: 5 }, // 500kg volume
          { weightKg: 100, reps: 5 }, // 500kg volume
        ],
      },
    ];

    const result = await getMuscleVolumeByWeek("u", makePrisma(sessionExercises), 4);
    expect(result.muscleGroups).toContain("QUADS");

    const thisWeekStr = thisMonday().toISOString().slice(0, 10);
    const thisWeek = result.weeks.find((w) => w.weekStart === thisWeekStr);
    expect(thisWeek?.QUADS).toBe(1000); // 2 sets × 500
  });

  it("distributes volume evenly across primary muscles", async () => {
    const sessionExercises = [
      {
        session: { startedAt: thisMonday() },
        exercise: { primaryMuscles: ["QUADS", "GLUTES"] },
        sets: [{ weightKg: 100, reps: 10 }], // 1000kg total
      },
    ];

    const result = await getMuscleVolumeByWeek("u", makePrisma(sessionExercises), 1);
    const thisWeek = result.weeks[0];
    // 1000 / 2 muscles = 500 each
    expect(thisWeek.QUADS).toBe(500);
    expect(thisWeek.GLUTES).toBe(500);
  });

  it("skips session exercises with no completed sets", async () => {
    const sessionExercises = [
      {
        session: { startedAt: thisMonday() },
        exercise: { primaryMuscles: ["CHEST"] },
        sets: [], // no sets
      },
    ];
    const result = await getMuscleVolumeByWeek("u", makePrisma(sessionExercises), 1);
    expect(result.muscleGroups).toHaveLength(0);
  });
});
