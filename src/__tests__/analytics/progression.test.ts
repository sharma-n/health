import { getExerciseProgression, getTrainedExercises } from "@/lib/analytics/progression";
import type { PrismaClient } from "@/generated/prisma/client";

function makePrisma(overrides: object): PrismaClient {
  return overrides as unknown as PrismaClient;
}

const SESSION_1_ID = "session-1";
const SESSION_2_ID = "session-2";

describe("getExerciseProgression", () => {
  it("returns a progression point per session", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn().mockResolvedValue([
          {
            session: { id: SESSION_1_ID, startedAt: new Date("2026-06-01") },
            sets: [{ weightKg: 80, reps: 5 }, { weightKg: 85, reps: 5 }],
          },
          {
            session: { id: SESSION_2_ID, startedAt: new Date("2026-06-08") },
            sets: [{ weightKg: 90, reps: 5 }],
          },
        ]),
      },
    });

    const result = await getExerciseProgression("u", "ex", prisma);

    expect(result).toHaveLength(2);
    expect(result[0].sessionId).toBe(SESSION_1_ID);
    expect(result[0].topWeightKg).toBe(85);
    expect(result[0].totalSets).toBe(2);
    // Volume: 80×5 + 85×5 = 825
    expect(result[0].totalVolumeKg).toBe(825);
    // Best 1RM: 85 × (1 + 5/30) ≈ 99.2
    expect(result[0].estimatedOneRM).toBeCloseTo(99.2, 0);

    expect(result[1].topWeightKg).toBe(90);
  });

  it("deduplicates when the same exercise appears in a session twice", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn().mockResolvedValue([
          {
            session: { id: SESSION_1_ID, startedAt: new Date("2026-06-01") },
            sets: [{ weightKg: 100, reps: 3 }],
          },
          {
            // Same session id — should be merged
            session: { id: SESSION_1_ID, startedAt: new Date("2026-06-01") },
            sets: [{ weightKg: 80, reps: 5 }],
          },
        ]),
      },
    });

    const result = await getExerciseProgression("u", "ex", prisma);
    expect(result).toHaveLength(1);
    expect(result[0].totalSets).toBe(2); // both sets merged
  });

  it("returns empty array when no sessions found", async () => {
    const prisma = makePrisma({
      sessionExercise: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const result = await getExerciseProgression("u", "ex", prisma);
    expect(result).toHaveLength(0);
  });

  it("returns null for topWeight and 1RM when all sets have no weight", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn().mockResolvedValue([
          {
            session: { id: SESSION_1_ID, startedAt: new Date("2026-06-01") },
            sets: [{ weightKg: null, reps: 10 }],
          },
        ]),
      },
    });
    const result = await getExerciseProgression("u", "ex", prisma);
    expect(result[0].topWeightKg).toBeNull();
    expect(result[0].estimatedOneRM).toBeNull();
    expect(result[0].totalVolumeKg).toBe(0);
    expect(result[0].totalSets).toBe(0);
  });
});

describe("getTrainedExercises", () => {
  it("returns unique exercises ordered by most recent", async () => {
    const prisma = makePrisma({
      sessionExercise: {
        findMany: vi.fn().mockResolvedValue([
          {
            exerciseId: "ex-2",
            exercise: { id: "ex-2", name: "Deadlift", isSystem: true },
            session: { startedAt: new Date("2026-06-08") },
          },
          {
            exerciseId: "ex-1",
            exercise: { id: "ex-1", name: "Squat", isSystem: false },
            session: { startedAt: new Date("2026-06-01") },
          },
          {
            exerciseId: "ex-2",
            // duplicate — should be excluded
            exercise: { id: "ex-2", name: "Deadlift", isSystem: true },
            session: { startedAt: new Date("2026-05-25") },
          },
        ]),
      },
    });

    const result = await getTrainedExercises("u", prisma);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("ex-2"); // most recent first
    expect(result[1].id).toBe("ex-1");
  });

  it("returns empty array when no sessions", async () => {
    const prisma = makePrisma({
      sessionExercise: { findMany: vi.fn().mockResolvedValue([]) },
    });
    expect(await getTrainedExercises("u", prisma)).toHaveLength(0);
  });
});
