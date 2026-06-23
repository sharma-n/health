import type { PrismaClient } from "@/generated/prisma/client";
import { todayInTz } from "@/lib/dates";

export interface HeatmapDay {
  date: string; // "YYYY-MM-DD"
  count: number;
}

export interface WeeklyBar {
  label: string; // "Jun 16"
  weekStart: string; // "YYYY-MM-DD"
  completed: number;
  scheduled: number | null;
}

export interface AdherenceStats {
  currentStreak: number;
  longestStreak: number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  totalCompleted: number;
  heatmapData: HeatmapDay[];
  weeklyBars: WeeklyBar[];
}

/** UTC-based date string — used for week-boundary arithmetic (anchors, not session bucketing). */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Convert a UTC timestamp to YYYY-MM-DD in the user's timezone for session bucketing. */
function toDateStrInTz(d: Date, tz: string): string {
  try {
    return d.toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function startOfWeek(d: Date): Date {
  // Returns Monday 00:00 UTC for the week containing d
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

export async function getAdherenceStats(
  userId: string,
  prisma: PrismaClient,
  timezone = "UTC",
): Promise<AdherenceStats> {
  const now = new Date();
  const todayStr = todayInTz(timezone);

  // Fetch all completed sessions in the last 16 weeks (112 days) + extra for streak
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 120);
  since.setUTCHours(0, 0, 0, 0);

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      endedAt: { not: null },
      startedAt: { gte: since },
    },
    select: { startedAt: true },
    orderBy: { startedAt: "asc" },
  });

  // Total completed (all time)
  const totalCompleted = await prisma.session.count({
    where: { userId, endedAt: { not: null } },
  });

  // Build a set of dates with sessions — bucketed by user's local timezone date.
  const sessionDates = new Set<string>();
  for (const s of sessions) {
    sessionDates.add(toDateStrInTz(s.startedAt, timezone));
  }

  // ── Streak calculation ──────────────────────────────────────────────────────
  let currentStreak = 0;
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  // Walk backwards from today
  while (sessionDates.has(toDateStr(cursor))) {
    currentStreak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Longest streak over the fetched window
  let longestStreak = currentStreak;
  let run = 0;
  const allDates: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    allDates.push(toDateStr(d));
  }
  for (const dateStr of allDates) {
    if (sessionDates.has(dateStr)) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  // ── This week / last week ──────────────────────────────────────────────────
  const thisMonday = startOfWeek(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);
  lastSunday.setUTCHours(23, 59, 59, 999);

  let sessionsThisWeek = 0;
  let sessionsLastWeek = 0;
  for (const s of sessions) {
    if (s.startedAt >= thisMonday) sessionsThisWeek++;
    else if (s.startedAt >= lastMonday && s.startedAt <= lastSunday) sessionsLastWeek++;
  }

  // ── Heatmap (last 112 days) ────────────────────────────────────────────────
  const heatmapData: HeatmapDay[] = [];
  const heatmapStart = new Date(now);
  heatmapStart.setUTCDate(heatmapStart.getUTCDate() - 111);
  heatmapStart.setUTCHours(0, 0, 0, 0);

  const countByDate = new Map<string, number>();
  for (const s of sessions) {
    const d = toDateStrInTz(s.startedAt, timezone);
    countByDate.set(d, (countByDate.get(d) ?? 0) + 1);
  }

  for (let i = 0; i < 112; i++) {
    const d = new Date(heatmapStart);
    d.setUTCDate(heatmapStart.getUTCDate() + i);
    const dateStr = toDateStr(d);
    heatmapData.push({ date: dateStr, count: countByDate.get(dateStr) ?? 0 });
  }

  // ── Weekly bars (last 12 weeks) ────────────────────────────────────────────
  // Find scheduled sessions from active/completed plans in the window
  const twelveWeeksAgo = new Date(thisMonday);
  twelveWeeksAgo.setUTCDate(thisMonday.getUTCDate() - 11 * 7);

  const planItems = await prisma.planScheduleItem.findMany({
    where: {
      plan: {
        ownerId: userId,
        status: { in: ["ACTIVE", "COMPLETED"] },
        startDate: { lte: new Date(todayStr) },
        endDate: { gte: twelveWeeksAgo },
      },
    },
    select: {
      dayOfWeek: true,
      plan: { select: { startDate: true, endDate: true } },
    },
  });

  // Count scheduled occurrences per week
  const scheduledByWeek = new Map<string, number>();
  for (const item of planItems) {
    const planStart = new Date(item.plan.startDate);
    const planEnd = new Date(item.plan.endDate);
    // Walk through each occurrence of this dayOfWeek in the plan's range
    for (let wk = 0; wk < 12; wk++) {
      const weekMon = new Date(twelveWeeksAgo);
      weekMon.setUTCDate(twelveWeeksAgo.getUTCDate() + wk * 7);
      // Find the date in this week matching dayOfWeek
      const dayOffset = (item.dayOfWeek - weekMon.getUTCDay() + 7) % 7;
      const occDate = new Date(weekMon);
      occDate.setUTCDate(weekMon.getUTCDate() + dayOffset);
      if (occDate >= planStart && occDate <= planEnd) {
        const wkKey = toDateStr(weekMon);
        scheduledByWeek.set(wkKey, (scheduledByWeek.get(wkKey) ?? 0) + 1);
      }
    }
  }

  // Bucket completed sessions by week start
  const completedByWeek = new Map<string, number>();
  for (const s of sessions) {
    if (s.startedAt < twelveWeeksAgo) continue;
    const wkMon = startOfWeek(s.startedAt);
    const key = toDateStr(wkMon);
    completedByWeek.set(key, (completedByWeek.get(key) ?? 0) + 1);
  }

  const weeklyBars: WeeklyBar[] = [];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  for (let wk = 0; wk < 12; wk++) {
    const weekMon = new Date(twelveWeeksAgo);
    weekMon.setUTCDate(twelveWeeksAgo.getUTCDate() + wk * 7);
    const key = toDateStr(weekMon);
    const label = `${monthNames[weekMon.getUTCMonth()]} ${weekMon.getUTCDate()}`;
    const hasScheduled = scheduledByWeek.has(key);
    weeklyBars.push({
      label,
      weekStart: key,
      completed: completedByWeek.get(key) ?? 0,
      scheduled: hasScheduled ? scheduledByWeek.get(key)! : null,
    });
  }

  return {
    currentStreak,
    longestStreak,
    sessionsThisWeek,
    sessionsLastWeek,
    totalCompleted,
    heatmapData,
    weeklyBars,
  };
}
