import { getDashboardStats } from "@/lib/analytics/dashboard";
import type { PrismaClient } from "@/generated/prisma/client";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(10, 0, 0, 0);
  return d;
}

function makePrisma(sessions: Date[], prsRows: object[]): PrismaClient {
  return {
    session: {
      findMany: vi.fn().mockResolvedValue(sessions.map((d) => ({ startedAt: d }))),
      count: vi.fn().mockResolvedValue(sessions.length),
    },
    planScheduleItem: { findMany: vi.fn().mockResolvedValue([]) },
    sessionExercise: {
      findMany: vi.fn()
        .mockResolvedValueOnce(prsRows.map((r: any) => ({ exerciseId: r.exerciseId }))) // recentExercises
        .mockResolvedValueOnce(prsRows), // rows
    },
  } as unknown as PrismaClient;
}

describe("getDashboardStats", () => {
  it("returns zero stats when no data", async () => {
    const stats = await getDashboardStats("u", makePrisma([], []));
    expect(stats.currentStreak).toBe(0);
    expect(stats.sessionsThisWeek).toBe(0);
    expect(stats.totalCompleted).toBe(0);
    expect(stats.recentPRs).toHaveLength(0);
  });

  it("combines streak from adherence and filters PRs to only new ones", async () => {
    const RECENT = daysAgo(1);
    const OLD = daysAgo(60);

    const prsRows = [
      {
        exerciseId: "ex-1",
        exercise: { name: "Squat" },
        session: { startedAt: OLD },
        sets: [{ weightKg: 80, reps: 5 }],
      },
      {
        exerciseId: "ex-1",
        exercise: { name: "Squat" },
        session: { startedAt: RECENT },
        sets: [{ weightKg: 100, reps: 5 }], // new PR!
      },
    ];

    const stats = await getDashboardStats("u", makePrisma([daysAgo(0), daysAgo(1)], prsRows));
    expect(stats.currentStreak).toBeGreaterThanOrEqual(1);
    // recentPRs should only include the new ones (achieved in last 14 days)
    expect(stats.recentPRs.every((pr) => pr.isNew)).toBe(true);
    expect(stats.recentPRs.length).toBeGreaterThan(0);
  });
});
