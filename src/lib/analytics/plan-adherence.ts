import type { PrismaClient } from "@/generated/prisma/client";
import { todayInTz } from "@/lib/dates";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toDateStrInTz(d: Date, tz: string): string {
  try {
    return d.toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

function calendarDayDiff(sessionDateStr: string, occurrenceDateStr: string): number {
  const a = new Date(sessionDateStr + "T00:00:00Z");
  const b = new Date(occurrenceDateStr + "T00:00:00Z");
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export type OccurrenceStatus =
  | "completed"
  | "completed_late"
  | "completed_early"
  | "missed"
  | "upcoming";

export interface OccurrenceResult {
  occurrenceDate: string;
  dayOfWeek: number;
  workoutId: string;
  workoutName: string;
  status: OccurrenceStatus;
  matchedSessionId: string | null;
  matchedSessionDate: string | null;
}

export interface PlanAdherenceResult {
  planId: string;
  planName: string;
  thisWeekStart: string;
  thisWeek: OccurrenceResult[];
  overall: {
    completed: number;
    missed: number;
    upcoming: number;
    adherencePct: number | null;
  };
  allOccurrences: OccurrenceResult[];
}

export async function getPlanAdherence(
  planId: string,
  userId: string,
  prisma: PrismaClient,
  timezone: string,
): Promise<PlanAdherenceResult> {
  const makeupWindow = Math.max(
    1,
    parseInt(process.env.ADHERENCE_MAKEUP_WINDOW_DAYS ?? "3", 10),
  );

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      startDate: true,
      endDate: true,
      schedule: {
        select: {
          dayOfWeek: true,
          workoutId: true,
          workout: {
            select: {
              id: true,
              name: true,
              exercises: { select: { exerciseId: true } },
            },
          },
        },
      },
    },
  });

  if (!plan || plan.ownerId !== userId) {
    throw new Error("Plan not found");
  }

  const empty: PlanAdherenceResult = {
    planId: plan.id,
    planName: plan.name,
    thisWeekStart: "",
    thisWeek: [],
    overall: { completed: 0, missed: 0, upcoming: 0, adherencePct: null },
    allOccurrences: [],
  };

  if (plan.schedule.length === 0) return empty;

  const todayStr = todayInTz(timezone);
  const todayDate = new Date(todayStr + "T00:00:00Z");

  type ScheduleItem = {
    dayOfWeek: number;
    workoutId: string;
    workoutName: string;
    exerciseIds: Set<string>;
  };
  const scheduleItems: ScheduleItem[] = plan.schedule.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    workoutId: s.workout.id,
    workoutName: s.workout.name,
    exerciseIds: new Set(s.workout.exercises.map((e) => e.exerciseId)),
  }));

  // Generate all occurrences from plan start to plan end
  const occurrences: Array<ScheduleItem & { occurrenceDate: string }> = [];
  const cursor = new Date(plan.startDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const planEnd = new Date(plan.endDate);
  planEnd.setUTCHours(0, 0, 0, 0);

  while (cursor <= planEnd) {
    const dow = cursor.getUTCDay();
    for (const item of scheduleItems) {
      if (item.dayOfWeek === dow) {
        occurrences.push({ ...item, occurrenceDate: toDateStr(cursor) });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (occurrences.length === 0) return empty;

  // Fetch candidate sessions within the plan window ± makeupWindow buffer
  const windowStart = new Date(plan.startDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - makeupWindow);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(planEnd);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + makeupWindow);

  const rawSessions = await prisma.session.findMany({
    where: {
      userId,
      endedAt: { not: null },
      startedAt: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      planId: true,
      workoutId: true,
      scheduledDate: true,
      startedAt: true,
      exercises: { select: { exerciseId: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  type CandidateSession = {
    id: string;
    planId: string | null;
    workoutId: string | null;
    scheduledDateStr: string | null;
    sessionDateStr: string;
    exerciseIds: Set<string>;
  };

  const sessions: CandidateSession[] = rawSessions.map((s) => ({
    id: s.id,
    planId: s.planId,
    workoutId: s.workoutId,
    scheduledDateStr: s.scheduledDate ? toDateStr(s.scheduledDate) : null,
    sessionDateStr: toDateStrInTz(s.startedAt, timezone),
    exerciseIds: new Set(s.exercises.map((e) => e.exerciseId)),
  }));

  // Greedy matching — O(occurrences × sessions), bounded and fast
  const usedSessionIds = new Set<string>();

  const results: OccurrenceResult[] = occurrences.map((occ) => {
    let bestSession: CandidateSession | null = null;
    let bestTier = 4;
    let bestAbsDelta = Infinity;

    for (const sess of sessions) {
      if (usedSessionIds.has(sess.id)) continue;

      const delta = calendarDayDiff(sess.sessionDateStr, occ.occurrenceDate);
      let tier = 4;

      // Tier 1: session explicitly linked to this plan on the scheduled date
      if (sess.planId === planId && sess.scheduledDateStr !== null) {
        const t1Delta = calendarDayDiff(sess.scheduledDateStr, occ.occurrenceDate);
        if (Math.abs(t1Delta) <= 1) tier = 1;
      }

      // Tier 2: matching workout template within makeup window
      if (tier === 4 && sess.workoutId === occ.workoutId && Math.abs(delta) <= makeupWindow) {
        tier = 2;
      }

      // Tier 3: ≥50% exercise overlap within makeup window
      if (tier === 4 && Math.abs(delta) <= makeupWindow && occ.exerciseIds.size > 0) {
        const overlap = [...sess.exerciseIds].filter((id) => occ.exerciseIds.has(id)).length;
        if (overlap / occ.exerciseIds.size >= 0.5) tier = 3;
      }

      if (tier === 4) continue;

      const absDelta = Math.abs(delta);
      const isBetter =
        tier < bestTier ||
        (tier === bestTier && absDelta < bestAbsDelta) ||
        (tier === bestTier && absDelta === bestAbsDelta && delta > 0);

      if (isBetter) {
        bestTier = tier;
        bestAbsDelta = absDelta;
        bestSession = sess;
      }
    }

    if (bestSession) {
      usedSessionIds.add(bestSession.id);
      const delta = calendarDayDiff(bestSession.sessionDateStr, occ.occurrenceDate);
      let status: OccurrenceStatus;
      if (Math.abs(delta) <= 1) {
        status = "completed";
      } else if (delta > 0) {
        status = "completed_late";
      } else {
        status = "completed_early";
      }
      return {
        occurrenceDate: occ.occurrenceDate,
        dayOfWeek: occ.dayOfWeek,
        workoutId: occ.workoutId,
        workoutName: occ.workoutName,
        status,
        matchedSessionId: bestSession.id,
        matchedSessionDate: bestSession.sessionDateStr,
      };
    }

    // Strictly past occurrences (before today) are missed; today and future are upcoming
    const status: OccurrenceStatus = occ.occurrenceDate < todayStr ? "missed" : "upcoming";
    return {
      occurrenceDate: occ.occurrenceDate,
      dayOfWeek: occ.dayOfWeek,
      workoutId: occ.workoutId,
      workoutName: occ.workoutName,
      status,
      matchedSessionId: null,
      matchedSessionDate: null,
    };
  });

  // This week: Mon–Sun window containing today
  const thisWeekMonday = startOfWeekMonday(todayDate);
  const thisWeekSunday = new Date(thisWeekMonday);
  thisWeekSunday.setUTCDate(thisWeekMonday.getUTCDate() + 6);
  const thisWeekStart = toDateStr(thisWeekMonday);
  const thisWeekEnd = toDateStr(thisWeekSunday);
  const thisWeek = results.filter(
    (o) => o.occurrenceDate >= thisWeekStart && o.occurrenceDate <= thisWeekEnd,
  );

  const completedCount = results.filter(
    (o) =>
      o.status === "completed" ||
      o.status === "completed_late" ||
      o.status === "completed_early",
  ).length;
  const missedCount = results.filter((o) => o.status === "missed").length;
  const upcomingCount = results.filter((o) => o.status === "upcoming").length;
  const total = completedCount + missedCount;
  const adherencePct = total > 0 ? Math.round((completedCount / total) * 100) : null;

  return {
    planId: plan.id,
    planName: plan.name,
    thisWeekStart: toDateStr(thisWeekMonday),
    thisWeek,
    overall: {
      completed: completedCount,
      missed: missedCount,
      upcoming: upcomingCount,
      adherencePct,
    },
    allOccurrences: results,
  };
}
