import type { PrismaClient } from "@/generated/prisma/client";

export interface MuscleVolumeWeek {
  weekLabel: string; // "Jun 16"
  weekStart: string; // "YYYY-MM-DD"
  [muscleGroup: string]: number | string; // dynamic keys for each muscle group
}

export interface MuscleVolumeData {
  weeks: MuscleVolumeWeek[];
  muscleGroups: string[]; // sorted list of all muscle groups that appear in the data
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

export async function getMuscleVolumeByWeek(
  userId: string,
  prisma: PrismaClient,
  weeks = 8,
): Promise<MuscleVolumeData> {
  const now = new Date();
  const thisMonday = startOfWeekMonday(now);
  const windowStart = new Date(thisMonday);
  windowStart.setUTCDate(thisMonday.getUTCDate() - (weeks - 1) * 7);

  // Fetch all session exercises with their completed sets and exercise muscle data
  const sessionExercises = await prisma.sessionExercise.findMany({
    where: {
      session: {
        userId,
        endedAt: { not: null },
        startedAt: { gte: windowStart },
      },
    },
    select: {
      session: { select: { startedAt: true } },
      exercise: { select: { primaryMuscles: true } },
      sets: {
        where: { completed: true, weightKg: { not: null }, reps: { not: null } },
        select: { weightKg: true, reps: true },
      },
    },
  });

  // Build week buckets
  const weekStarts: Date[] = [];
  for (let i = 0; i < weeks; i++) {
    const wk = new Date(windowStart);
    wk.setUTCDate(windowStart.getUTCDate() + i * 7);
    weekStarts.push(wk);
  }

  // volumeMap[weekStart][muscleGroup] = total volume kg
  const volumeMap = new Map<string, Map<string, number>>();
  for (const wk of weekStarts) {
    volumeMap.set(toDateStr(wk), new Map());
  }

  const allMuscleGroups = new Set<string>();

  for (const se of sessionExercises) {
    if (se.sets.length === 0) continue;

    // Parse muscle groups from JSON
    let muscles: string[] = [];
    try {
      const parsed = se.exercise.primaryMuscles;
      if (Array.isArray(parsed)) {
        muscles = parsed as string[];
      }
    } catch {
      continue;
    }
    if (muscles.length === 0) continue;

    // Find the week bucket
    const sessionMon = startOfWeekMonday(se.session.startedAt);
    const weekKey = toDateStr(sessionMon);
    if (!volumeMap.has(weekKey)) continue;

    const sessionVolume = se.sets.reduce(
      (sum, s) => sum + s.weightKg! * s.reps!,
      0,
    );
    const volumePerMuscle = sessionVolume / muscles.length;

    const weekData = volumeMap.get(weekKey)!;
    for (const muscle of muscles) {
      allMuscleGroups.add(muscle);
      weekData.set(muscle, (weekData.get(muscle) ?? 0) + volumePerMuscle);
    }
  }

  const muscleGroups = [...allMuscleGroups].sort();

  const resultWeeks: MuscleVolumeWeek[] = weekStarts.map((wk) => {
    const key = toDateStr(wk);
    const weekData = volumeMap.get(key) ?? new Map();
    const label = `${MONTH_NAMES[wk.getUTCMonth()]} ${wk.getUTCDate()}`;
    const row: MuscleVolumeWeek = { weekLabel: label, weekStart: key };
    for (const mg of muscleGroups) {
      row[mg] = Math.round(weekData.get(mg) ?? 0);
    }
    return row;
  });

  return { weeks: resultWeeks, muscleGroups };
}
