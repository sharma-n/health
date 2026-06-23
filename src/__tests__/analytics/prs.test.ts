import { getPersonalRecords } from "@/lib/analytics/prs";
import type { PrismaClient } from "@/generated/prisma/client";

function makePrisma(overrides: object): PrismaClient {
  return overrides as unknown as PrismaClient;
}

const RECENT = new Date(); // today
const OLD = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
const VERY_OLD = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

function makeRows(exerciseId: string, name: string, sessions: Array<{ date: Date; weightKg: number; reps: number }>) {
  return sessions.map((s) => ({
    exerciseId,
    exercise: { name },
    session: { startedAt: s.date },
    sets: [{ weightKg: s.weightKg, reps: s.reps }],
  }));
}

describe("getPersonalRecords", () => {
  it("returns empty array when no recent exercises", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn()
          .mockResolvedValueOnce([]) // recentExercises query
          .mockResolvedValueOnce([]), // rows query (not reached)
      },
    });
    const result = await getPersonalRecords("u", prisma);
    expect(result).toHaveLength(0);
  });

  it("skips exercises with only one session (no PR to detect)", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ exerciseId: "ex-1" }]) // recent exercises
          .mockResolvedValueOnce(makeRows("ex-1", "Squat", [
            { date: RECENT, weightKg: 100, reps: 5 },
          ])),
      },
    });
    const result = await getPersonalRecords("u", prisma);
    expect(result).toHaveLength(0);
  });

  it("detects PR when second session beats first in all three metrics", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ exerciseId: "ex-1" }])
          .mockResolvedValueOnce(makeRows("ex-1", "Squat", [
            { date: VERY_OLD, weightKg: 80, reps: 5 },
            { date: RECENT, weightKg: 100, reps: 5 }, // new PR
          ])),
      },
    });
    const result = await getPersonalRecords("u", prisma);
    // Three PR types (estimatedOneRM, topWeight, totalVolume) × 1 exercise = 3
    expect(result).toHaveLength(3);
    // All PRs are recent
    expect(result.every((pr) => pr.isNew)).toBe(true);
    expect(result.every((pr) => pr.exerciseName === "Squat")).toBe(true);
  });

  it("marks PR as not new when achieved more than 14 days ago", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ exerciseId: "ex-1" }])
          .mockResolvedValueOnce(makeRows("ex-1", "Bench", [
            { date: VERY_OLD, weightKg: 80, reps: 5 },
            { date: OLD, weightKg: 100, reps: 5 }, // PR but 30 days ago (> 14)
          ])),
      },
    });
    const result = await getPersonalRecords("u", prisma);
    expect(result.every((pr) => !pr.isNew)).toBe(true);
  });

  it("sorts new PRs before old ones", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ exerciseId: "ex-1" }, { exerciseId: "ex-2" }])
          .mockResolvedValueOnce([
            ...makeRows("ex-1", "Squat", [
              { date: VERY_OLD, weightKg: 80, reps: 5 },
              { date: OLD, weightKg: 100, reps: 5 }, // old PR
            ]),
            ...makeRows("ex-2", "Bench", [
              { date: VERY_OLD, weightKg: 60, reps: 5 },
              { date: RECENT, weightKg: 80, reps: 5 }, // new PR
            ]),
          ]),
      },
    });
    const result = await getPersonalRecords("u", prisma);
    // All Bench (new) PRs should come before Squat (old) PRs
    const newPRs = result.filter((pr) => pr.isNew);
    const oldPRs = result.filter((pr) => !pr.isNew);
    expect(newPRs.length).toBeGreaterThan(0);
    expect(oldPRs.length).toBeGreaterThan(0);
    // New PRs should be first
    const firstOldIndex = result.findIndex((pr) => !pr.isNew);
    const lastNewIndex = result.map((pr) => pr.isNew).lastIndexOf(true);
    expect(lastNewIndex).toBeLessThan(firstOldIndex);
  });
});
