import { getAdherenceStats } from "@/lib/analytics/adherence";
import type { PrismaClient } from "@/generated/prisma/client";

function makePrisma(sessions: Date[], totalCompleted = sessions.length): PrismaClient {
  return {
    session: {
      findMany: vi.fn().mockResolvedValue(sessions.map((d) => ({ startedAt: d }))),
      count: vi.fn().mockResolvedValue(totalCompleted),
    },
    planScheduleItem: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaClient;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(10, 0, 0, 0); // 10am UTC to avoid edge cases
  return d;
}

describe("getAdherenceStats", () => {
  it("returns zero stats when no sessions", async () => {
    const stats = await getAdherenceStats("u", makePrisma([]));
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
    expect(stats.sessionsThisWeek).toBe(0);
    expect(stats.sessionsLastWeek).toBe(0);
    expect(stats.totalCompleted).toBe(0);
  });

  it("computes a streak of 1 for today only", async () => {
    const stats = await getAdherenceStats("u", makePrisma([daysAgo(0)]));
    expect(stats.currentStreak).toBe(1);
  });

  it("computes a streak of 3 for 3 consecutive days ending today", async () => {
    const stats = await getAdherenceStats("u", makePrisma([daysAgo(2), daysAgo(1), daysAgo(0)]));
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBeGreaterThanOrEqual(3);
  });

  it("breaks streak when yesterday is missing", async () => {
    const stats = await getAdherenceStats("u", makePrisma([daysAgo(2), daysAgo(0)]));
    // Today only = streak of 1
    expect(stats.currentStreak).toBe(1);
  });

  it("longest streak is 0 when today is not worked out", async () => {
    // Only trained 5 days ago (not today)
    const stats = await getAdherenceStats("u", makePrisma([daysAgo(5)]));
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(1);
  });

  it("returns 112 heatmap entries", async () => {
    const stats = await getAdherenceStats("u", makePrisma([]));
    expect(stats.heatmapData).toHaveLength(112);
  });

  it("returns 12 weekly bar entries", async () => {
    const stats = await getAdherenceStats("u", makePrisma([]));
    expect(stats.weeklyBars).toHaveLength(12);
  });

  it("counts total completed from DB count (not session list)", async () => {
    // total in DB is 100, but only 2 in the window
    const stats = await getAdherenceStats("u", makePrisma([daysAgo(1), daysAgo(0)], 100));
    expect(stats.totalCompleted).toBe(100);
  });

  it("heatmap entry for today has count of 1 when session today", async () => {
    const stats = await getAdherenceStats("u", makePrisma([daysAgo(0)]));
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = stats.heatmapData.find((d) => d.date === today);
    expect(todayEntry?.count).toBe(1);
  });
});
