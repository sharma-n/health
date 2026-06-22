import type { PrismaClient } from "@/generated/prisma/client";

export type PRType = "estimatedOneRM" | "topWeight" | "totalVolume";

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  prType: PRType;
  value: number;
  unit: string;
  achievedAt: string; // "YYYY-MM-DD"
  isNew: boolean; // achieved in the last 14 days
}

const PR_UNIT: Record<PRType, string> = {
  estimatedOneRM: "kg",
  topWeight: "kg",
  totalVolume: "kg",
};

const PR_LABEL: Record<PRType, string> = {
  estimatedOneRM: "Est. 1RM",
  topWeight: "Top Weight",
  totalVolume: "Total Volume",
};

export { PR_LABEL };

export async function getPersonalRecords(
  userId: string,
  prisma: PrismaClient,
): Promise<PersonalRecord[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);

  // Get exercises the user has trained in the last 90 days
  const recentExercises = await prisma.sessionExercise.findMany({
    where: {
      session: { userId, endedAt: { not: null }, startedAt: { gte: cutoff } },
    },
    select: { exerciseId: true },
    distinct: ["exerciseId"],
  });
  const exerciseIds = recentExercises.map((e) => e.exerciseId);
  if (exerciseIds.length === 0) return [];

  // For each exercise, fetch all completed sets with their session date
  const rows = await prisma.sessionExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      session: { userId, endedAt: { not: null } },
    },
    select: {
      exerciseId: true,
      exercise: { select: { name: true } },
      session: { select: { startedAt: true } },
      sets: {
        where: { completed: true, weightKg: { not: null }, reps: { not: null } },
        select: { weightKg: true, reps: true },
      },
    },
    orderBy: { session: { startedAt: "asc" } },
  });

  // Group by exercise, then by session date, compute per-session metrics
  type SessionMetrics = {
    date: Date;
    topWeight: number;
    estimatedOneRM: number;
    totalVolume: number;
  };

  const byExercise = new Map<
    string,
    { name: string; sessions: SessionMetrics[] }
  >();

  for (const row of rows) {
    if (row.sets.length === 0) continue;
    if (!byExercise.has(row.exerciseId)) {
      byExercise.set(row.exerciseId, { name: row.exercise.name, sessions: [] });
    }

    const topWeight = Math.max(...row.sets.map((s) => s.weightKg!));
    const estimatedOneRM = Math.max(
      ...row.sets.map((s) => s.weightKg! * (1 + s.reps! / 30)),
    );
    const totalVolume = row.sets.reduce((sum, s) => sum + s.weightKg! * s.reps!, 0);

    byExercise.get(row.exerciseId)!.sessions.push({
      date: row.session.startedAt,
      topWeight,
      estimatedOneRM: Math.round(estimatedOneRM * 10) / 10,
      totalVolume: Math.round(totalVolume),
    });
  }

  const newCutoff = new Date();
  newCutoff.setUTCDate(newCutoff.getUTCDate() - 14);

  const prs: PersonalRecord[] = [];

  for (const [exerciseId, { name, sessions }] of byExercise.entries()) {
    if (sessions.length < 2) continue; // skip exercises with only one session — not enough data to detect a PR

    const types: PRType[] = ["estimatedOneRM", "topWeight", "totalVolume"];

    for (const prType of types) {
      let allTimeBest = -Infinity;
      let bestDate: Date | null = null;

      for (const s of sessions) {
        const val = s[prType];
        if (val > allTimeBest) {
          allTimeBest = val;
          bestDate = s.date;
        }
      }

      if (bestDate == null) continue;

      prs.push({
        exerciseId,
        exerciseName: name,
        prType,
        value: allTimeBest,
        unit: PR_UNIT[prType],
        achievedAt: bestDate.toISOString().slice(0, 10),
        isNew: bestDate >= newCutoff,
      });
    }
  }

  // Sort: new PRs first, then by exercise name
  prs.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return a.exerciseName.localeCompare(b.exerciseName);
  });

  return prs;
}
