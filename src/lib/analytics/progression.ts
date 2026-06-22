import type { PrismaClient } from "@/generated/prisma/client";

export interface ProgressionPoint {
  date: string; // "YYYY-MM-DD"
  sessionId: string;
  topWeightKg: number | null;
  estimatedOneRM: number | null;
  totalVolumeKg: number;
  totalSets: number;
}

export interface ExerciseForPicker {
  id: string;
  name: string;
  isSystem: boolean;
}

export async function getExerciseProgression(
  userId: string,
  exerciseId: string,
  prisma: PrismaClient,
  limit = 30,
): Promise<ProgressionPoint[]> {
  // Find sessions containing this exercise, ordered by date
  const sessionExercises = await prisma.sessionExercise.findMany({
    where: {
      exerciseId,
      session: { userId, endedAt: { not: null } },
    },
    select: {
      session: { select: { id: true, startedAt: true } },
      sets: {
        where: { completed: true },
        select: { weightKg: true, reps: true },
      },
    },
    orderBy: { session: { startedAt: "asc" } },
  });

  // Deduplicate by session (an exercise can appear multiple times in one session)
  const bySession = new Map<
    string,
    { date: Date; sets: { weightKg: number | null; reps: number | null }[] }
  >();
  for (const se of sessionExercises) {
    const existing = bySession.get(se.session.id);
    if (existing) {
      existing.sets.push(...se.sets);
    } else {
      bySession.set(se.session.id, {
        date: se.session.startedAt,
        sets: [...se.sets],
      });
    }
  }

  // Take last N sessions
  const entries = [...bySession.entries()].slice(-limit);

  return entries.map(([sessionId, { date, sets }]) => {
    const completedSets = sets.filter((s) => s.weightKg != null && s.reps != null);

    const topWeightKg =
      completedSets.length > 0
        ? Math.max(...completedSets.map((s) => s.weightKg!))
        : null;

    const estimatedOneRM =
      completedSets.length > 0
        ? Math.max(
            ...completedSets.map((s) => s.weightKg! * (1 + s.reps! / 30)),
          )
        : null;

    const totalVolumeKg = completedSets.reduce(
      (sum, s) => sum + s.weightKg! * s.reps!,
      0,
    );

    return {
      date: date.toISOString().slice(0, 10),
      sessionId,
      topWeightKg,
      estimatedOneRM: estimatedOneRM != null ? Math.round(estimatedOneRM * 10) / 10 : null,
      totalVolumeKg: Math.round(totalVolumeKg),
      totalSets: completedSets.length,
    };
  });
}

export async function getTrainedExercises(
  userId: string,
  prisma: PrismaClient,
): Promise<ExerciseForPicker[]> {
  // Return all exercises the user has logged at least once, sorted by most recently used
  const sessionExercises = await prisma.sessionExercise.findMany({
    where: { session: { userId, endedAt: { not: null } } },
    select: {
      exerciseId: true,
      exercise: { select: { id: true, name: true, isSystem: true } },
      session: { select: { startedAt: true } },
    },
    orderBy: { session: { startedAt: "desc" } },
  });

  const seen = new Set<string>();
  const result: ExerciseForPicker[] = [];
  for (const se of sessionExercises) {
    if (!seen.has(se.exerciseId)) {
      seen.add(se.exerciseId);
      result.push({
        id: se.exercise.id,
        name: se.exercise.name,
        isSystem: se.exercise.isSystem,
      });
    }
  }
  return result;
}
