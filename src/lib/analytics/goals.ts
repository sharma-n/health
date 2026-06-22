import { PrismaClient } from "@/generated/prisma/client";

interface GoalProgress {
  current: number | null;
  target: number;
  percentage: number;
  unit: string;
}

/**
 * Compute progress for a goal given the user's historical data.
 * Handles three goal types: STRENGTH, BODY_METRIC, CONSISTENCY.
 */
export async function computeGoalProgress(
  goal: {
    userId: string;
    type: string;
    config: any;
  },
  prisma: PrismaClient,
): Promise<GoalProgress> {
  if (goal.type === "STRENGTH") {
    return computeStrengthGoalProgress(goal, prisma);
  } else if (goal.type === "BODY_METRIC") {
    return computeBodyMetricGoalProgress(goal, prisma);
  } else if (goal.type === "CONSISTENCY") {
    return computeConsistencyGoalProgress(goal, prisma);
  }

  return { current: null, target: 0, percentage: 0, unit: "" };
}

async function computeStrengthGoalProgress(
  goal: {
    userId: string;
    config: {
      exerciseId: string;
      metric: "1RM" | "weightForReps";
      targetValueKg: number;
      reps?: number;
    };
  },
  prisma: PrismaClient,
): Promise<GoalProgress> {
  const { exerciseId, metric, targetValueKg, reps } = goal.config;

  // Find all completed sets for this exercise
  const sets = await prisma.sessionSet.findMany({
    where: {
      completed: true,
      sessionExercise: {
        exercise: { id: exerciseId },
        session: { userId: goal.userId },
      },
    },
    select: {
      weightKg: true,
      reps: true,
    },
  });

  let currentValue: number | null = null;

  if (metric === "1RM") {
    // Estimate 1RM using Epley formula: 1RM = weight × (1 + reps/30)
    const estimates = sets
      .filter((s) => s.weightKg && s.reps)
      .map((s) => s.weightKg! * (1 + s.reps! / 30));

    if (estimates.length > 0) {
      currentValue = Math.max(...estimates);
    }
  } else if (metric === "weightForReps" && reps) {
    // Find best weight for the target rep count (exact or close)
    const closeMatch = sets
      .filter((s) => s.weightKg && s.reps === reps)
      .map((s) => s.weightKg!);

    if (closeMatch.length > 0) {
      currentValue = Math.max(...closeMatch);
    }
  }

  const percentage =
    currentValue !== null ? Math.min(100, (currentValue / targetValueKg) * 100) : 0;

  return {
    current: currentValue,
    target: targetValueKg,
    percentage,
    unit: "kg",
  };
}

async function computeBodyMetricGoalProgress(
  goal: {
    userId: string;
    config: {
      metricType: string;
      targetValue: number;
      direction: "increase" | "decrease";
    };
  },
  prisma: PrismaClient,
): Promise<GoalProgress> {
  const { metricType, targetValue, direction } = goal.config;

  // Find latest metric of this type
  const latestMetric = await prisma.bodyMetric.findFirst({
    where: {
      userId: goal.userId,
      type: metricType,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { value: true },
  });

  const currentValue = latestMetric?.value ?? null;

  let percentage = 0;
  let unit = ""; // will be set based on metric type

  if (currentValue !== null) {
    if (metricType === "BODY_FAT_PCT") {
      unit = "%";
    } else if (metricType === "BODYWEIGHT") {
      unit = "kg";
    } else {
      unit = "cm"; // waist, hips, chest, arms, thighs, calf, neck
    }

    if (direction === "increase") {
      percentage = Math.min(100, (currentValue / targetValue) * 100);
    } else {
      // direction === "decrease"
      // percentage = how much of the distance to the target we've covered
      const distance = Math.abs(currentValue - targetValue);
      percentage = 100 - Math.min(100, (distance / currentValue) * 100);
    }
  }

  return {
    current: currentValue,
    target: targetValue,
    percentage: Math.max(0, percentage),
    unit,
  };
}

async function computeConsistencyGoalProgress(
  goal: {
    userId: string;
    config: {
      workoutsPerWeek: number;
      windowStart?: Date;
      windowEnd?: Date;
    };
  },
  prisma: PrismaClient,
): Promise<GoalProgress> {
  const { workoutsPerWeek, windowStart, windowEnd } = goal.config;

  // If no window specified, use a default of the last 4 weeks
  const start = windowStart ? new Date(windowStart) : new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000);
  const end = windowEnd ? new Date(windowEnd) : new Date();

  // Count completed sessions (endedAt is not null)
  const completedSessions = await prisma.session.count({
    where: {
      userId: goal.userId,
      endedAt: { not: null },
      startedAt: {
        gte: start,
        lte: end,
      },
    },
  });

  // Calculate weeks in the window
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weeks = Math.max(1, Math.ceil(daysDiff / 7));

  const targetSessions = workoutsPerWeek * weeks;
  const percentage = Math.min(100, (completedSessions / targetSessions) * 100);

  return {
    current: completedSessions,
    target: targetSessions,
    percentage,
    unit: "sessions",
  };
}
