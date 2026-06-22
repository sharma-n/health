import type { PrismaClient } from "@/generated/prisma/client";
import type { MuscleGroup } from "@/lib/constants";

export type MuscleSetCounts = Partial<Record<MuscleGroup, number>>;

export async function getMuscleRecentVolume(
  userId: string,
  prisma: PrismaClient,
  days = 7,
): Promise<MuscleSetCounts> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const sessionExercises = await prisma.sessionExercise.findMany({
    where: {
      session: {
        userId,
        endedAt: { not: null },
        startedAt: { gte: since },
      },
    },
    select: {
      exercise: { select: { primaryMuscles: true } },
      sets: {
        where: { completed: true },
        select: { id: true },
      },
    },
  });

  const counts: MuscleSetCounts = {};
  for (const se of sessionExercises) {
    const completedCount = se.sets.length;
    if (completedCount === 0) continue;
    let muscles: MuscleGroup[] = [];
    try {
      const parsed = se.exercise.primaryMuscles;
      if (Array.isArray(parsed)) muscles = parsed as MuscleGroup[];
    } catch {
      continue;
    }
    for (const m of muscles) {
      counts[m] = (counts[m] ?? 0) + completedCount;
    }
  }

  return counts;
}
