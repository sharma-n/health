// Dev-seed script — resets all user accounts and populates a demo account with
// realistic workouts, sessions, plans, and goals spanning 3-4 months so the app
// immediately showcases full analytics, adherence tracking, and progression.
//
// Prerequisites: system exercises must already be seeded (npm run db:seed).
//
// Usage:
//   npm run db:dev-seed
//   # or directly:
//   npx tsx --env-file .env scripts/dev-seed.ts

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");

const adapter = new PrismaBetterSqlite3({ url });
const db = new PrismaClient({ adapter });

// UTC midnight for today (daysBack=0), or N days in the past (negative = future).
function utcMidnight(daysBack: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d;
}

// UTC midnight of the Monday that starts the current ISO week.
function thisWeekMonday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

// Returns a new Date that is `n` calendar days after `d`.
function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setUTCDate(d.getUTCDate() + n);
  return nd;
}

// Returns `d` with the time set to noon UTC (12:00:00Z).
// Use for session startedAt — noon UTC falls on the same calendar day
// in every timezone from UTC-12 to UTC+12, avoiding off-by-one dates.
function atNoon(d: Date): Date {
  const nd = new Date(d);
  nd.setUTCHours(12, 0, 0, 0);
  return nd;
}

async function requireExercise(name: string): Promise<string> {
  const ex = await db.exercise.findFirst({
    where: { isSystem: true, name },
    select: { id: true },
  });
  if (!ex) throw new Error(`System exercise not found: "${name}". Run npm run db:seed first.`);
  return ex.id;
}

async function logSession(opts: {
  userId: string;
  workoutId: string;
  planId: string;
  startedAt: Date;
  scheduledDate: Date;
  durationMinutes: number;
  effort: number;
  exercises: Array<{
    exerciseId: string;
    sets: Array<{ weightKg?: number; reps?: number }>;
  }>;
}) {
  const endedAt = new Date(opts.startedAt.getTime() + opts.durationMinutes * 60 * 1000);

  const session = await db.session.create({
    data: {
      userId: opts.userId,
      workoutId: opts.workoutId,
      planId: opts.planId,
      scheduledDate: opts.scheduledDate,
      startedAt: opts.startedAt,
      endedAt,
      durationSeconds: opts.durationMinutes * 60,
      overallEffort: opts.effort,
    },
    select: { id: true },
  });

  for (let i = 0; i < opts.exercises.length; i++) {
    const { exerciseId, sets } = opts.exercises[i];
    const se = await db.sessionExercise.create({
      data: { sessionId: session.id, exerciseId, order: i + 1 },
      select: { id: true },
    });
    await db.sessionSet.createMany({
      data: sets.map((s, idx) => ({
        sessionExerciseId: se.id,
        setNumber: idx + 1,
        weightKg: s.weightKg,
        reps: s.reps,
        completed: true,
      })),
    });
  }
}

async function main() {
  // ── 1. Wipe all user accounts and their data in FK-safe order.
  console.log("▸ Deleting all user accounts…");
  await db.sessionSet.deleteMany({});
  await db.sessionExercise.deleteMany({});
  await db.session.deleteMany({});
  await db.workoutExercise.deleteMany({});
  await db.planScheduleItem.deleteMany({});
  await db.plan.deleteMany({});
  await db.workout.deleteMany({});
  await db.bodyMetric.deleteMany({});
  await db.goal.deleteMany({});
  await db.exercise.deleteMany({ where: { isSystem: false } });
  await db.user.deleteMany();

  // ── 2. Demo user
  console.log("▸ Creating demo user dev@health.local / password123");
  const hash = await bcrypt.hash("password123", 12);
  const user = await db.user.create({
    data: {
      email: "dev@health.local",
      passwordHash: hash,
      displayName: "Demo Lifter",
      unitPreference: "KG",
      timezone: "America/New_York",
      isAdmin: true,
      onboardingComplete: true,
    },
    select: { id: true },
  });
  const uid = user.id;

  // ── 3. Look up system exercises
  console.log("▸ Loading system exercises…");
  const [
    benchId,
    ohpId,
    pushdownId,
    rowId,
    pullupId,
    deadliftId,
    squatId,
    rdlId,
    legPressId,
    inclineDbId,
    chestFlyId,
    facePullsId,
    legCurlId,
  ] = await Promise.all([
    requireExercise("Barbell Bench Press"),
    requireExercise("Barbell Overhead Press"),
    requireExercise("Cable Tricep Pushdown"),
    requireExercise("Barbell Bent-Over Row"),
    requireExercise("Pull-ups"),
    requireExercise("Barbell Deadlift"),
    requireExercise("Barbell Back Squat"),
    requireExercise("Barbell Romanian Deadlift"),
    requireExercise("Seated Leg Press"),
    requireExercise("Dumbbell Incline Bench Press"),
    requireExercise("Machine Chest Fly"),
    requireExercise("Resistance Band Face Pulls"),
    requireExercise("Leg Curl"),
  ]);

  // ── 4. Six workout templates (including supersets)
  console.log("▸ Creating 6 workout templates…");

  const pushWorkout = await db.workout.create({
    data: {
      ownerId: uid,
      name: "Push Day",
      description: "Chest, shoulders, triceps — compound focus",
      exercises: {
        create: [
          {
            exerciseId: benchId,
            order: 1,
            targetSets: 4,
            targetReps: 5,
            targetWeightKg: 90,
            restSeconds: 180,
            supersetGroup: null,
          },
          {
            exerciseId: pushdownId,
            order: 2,
            targetSets: 4,
            targetReps: 8,
            targetWeightKg: 35,
            restSeconds: 90,
            supersetGroup: "push-superset-1",
          },
          {
            exerciseId: ohpId,
            order: 3,
            targetSets: 3,
            targetReps: 8,
            targetWeightKg: 55,
            restSeconds: 120,
            supersetGroup: null,
          },
          {
            exerciseId: chestFlyId,
            order: 4,
            targetSets: 3,
            targetReps: 10,
            targetWeightKg: 20,
            restSeconds: 90,
            supersetGroup: null,
          },
        ],
      },
    },
    select: { id: true },
  });

  const pullWorkout = await db.workout.create({
    data: {
      ownerId: uid,
      name: "Pull Day",
      description: "Back, biceps, rear delts",
      exercises: {
        create: [
          {
            exerciseId: deadliftId,
            order: 1,
            targetSets: 3,
            targetReps: 3,
            targetWeightKg: 120,
            restSeconds: 240,
            supersetGroup: null,
          },
          {
            exerciseId: rowId,
            order: 2,
            targetSets: 4,
            targetReps: 6,
            targetWeightKg: 85,
            restSeconds: 120,
            supersetGroup: "pull-superset-1",
          },
          {
            exerciseId: pullupId,
            order: 3,
            targetSets: 4,
            targetReps: 8,
            targetWeightKg: null,
            restSeconds: 120,
            supersetGroup: "pull-superset-1",
          },
          {
            exerciseId: facePullsId,
            order: 4,
            targetSets: 3,
            targetReps: 15,
            targetWeightKg: 20,
            restSeconds: 60,
            supersetGroup: null,
          },
        ],
      },
    },
    select: { id: true },
  });

  const legWorkout = await db.workout.create({
    data: {
      ownerId: uid,
      name: "Leg Day",
      description: "Quads, hamstrings, glutes",
      exercises: {
        create: [
          {
            exerciseId: squatId,
            order: 1,
            targetSets: 4,
            targetReps: 5,
            targetWeightKg: 105,
            restSeconds: 240,
            supersetGroup: null,
          },
          {
            exerciseId: legPressId,
            order: 2,
            targetSets: 3,
            targetReps: 10,
            targetWeightKg: 180,
            restSeconds: 90,
            supersetGroup: "leg-superset-1",
          },
          {
            exerciseId: legCurlId,
            order: 3,
            targetSets: 3,
            targetReps: 12,
            targetWeightKg: 70,
            restSeconds: 60,
            supersetGroup: "leg-superset-1",
          },
          {
            exerciseId: rdlId,
            order: 4,
            targetSets: 3,
            targetReps: 8,
            targetWeightKg: 95,
            restSeconds: 120,
            supersetGroup: null,
          },
        ],
      },
    },
    select: { id: true },
  });

  const upperWorkout = await db.workout.create({
    data: {
      ownerId: uid,
      name: "Upper Body",
      description: "Upper/Lower split variant",
      exercises: {
        create: [
          {
            exerciseId: benchId,
            order: 1,
            targetSets: 4,
            targetReps: 6,
            targetWeightKg: 85,
            restSeconds: 180,
            supersetGroup: "upper-superset-1",
          },
          {
            exerciseId: rowId,
            order: 2,
            targetSets: 4,
            targetReps: 6,
            targetWeightKg: 85,
            restSeconds: 180,
            supersetGroup: "upper-superset-1",
          },
          {
            exerciseId: pullupId,
            order: 3,
            targetSets: 3,
            targetReps: 8,
            targetWeightKg: null,
            restSeconds: 120,
            supersetGroup: null,
          },
          {
            exerciseId: ohpId,
            order: 4,
            targetSets: 3,
            targetReps: 8,
            targetWeightKg: 50,
            restSeconds: 120,
            supersetGroup: null,
          },
        ],
      },
    },
    select: { id: true },
  });

  const lowerWorkout = await db.workout.create({
    data: {
      ownerId: uid,
      name: "Lower Body",
      description: "Heavy lower focus",
      exercises: {
        create: [
          {
            exerciseId: squatId,
            order: 1,
            targetSets: 4,
            targetReps: 5,
            targetWeightKg: 105,
            restSeconds: 240,
            supersetGroup: null,
          },
          {
            exerciseId: rdlId,
            order: 2,
            targetSets: 4,
            targetReps: 6,
            targetWeightKg: 100,
            restSeconds: 180,
            supersetGroup: "lower-superset-1",
          },
          {
            exerciseId: legPressId,
            order: 3,
            targetSets: 3,
            targetReps: 10,
            targetWeightKg: 180,
            restSeconds: 90,
            supersetGroup: "lower-superset-1",
          },
          {
            exerciseId: legCurlId,
            order: 4,
            targetSets: 3,
            targetReps: 12,
            targetWeightKg: 70,
            restSeconds: 60,
            supersetGroup: null,
          },
        ],
      },
    },
    select: { id: true },
  });

  const fullBodyWorkout = await db.workout.create({
    data: {
      ownerId: uid,
      name: "Full Body",
      description: "Full-body compound focus",
      exercises: {
        create: [
          {
            exerciseId: squatId,
            order: 1,
            targetSets: 3,
            targetReps: 5,
            targetWeightKg: 100,
            restSeconds: 240,
            supersetGroup: null,
          },
          {
            exerciseId: benchId,
            order: 2,
            targetSets: 3,
            targetReps: 5,
            targetWeightKg: 85,
            restSeconds: 180,
            supersetGroup: null,
          },
          {
            exerciseId: rowId,
            order: 3,
            targetSets: 3,
            targetReps: 5,
            targetWeightKg: 85,
            restSeconds: 180,
            supersetGroup: null,
          },
          {
            exerciseId: deadliftId,
            order: 4,
            targetSets: 2,
            targetReps: 3,
            targetWeightKg: 120,
            restSeconds: 300,
            supersetGroup: null,
          },
        ],
      },
    },
    select: { id: true },
  });

  // ── 5. Two plans: one completed (8 weeks ago), one active (starting 2 weeks ago)
  console.log("▸ Creating plans…");
  const thisMonday = thisWeekMonday();

  // Old plan: started 16 weeks ago, ended 8 weeks ago (8-week cycle)
  const oldPlanStart = addDays(thisMonday, -112); // 16 weeks = 112 days
  const oldPlanEnd = addDays(thisMonday, -56); // 8 weeks = 56 days

  const oldPlan = await db.plan.create({
    data: {
      ownerId: uid,
      name: "PPL Strength Block (Completed)",
      description: "8-week progressive overload cycle",
      startDate: oldPlanStart,
      endDate: oldPlanEnd,
      status: "COMPLETED",
      schedule: {
        create: [
          { dayOfWeek: 1, workoutId: pushWorkout.id }, // Monday
          { dayOfWeek: 3, workoutId: pullWorkout.id }, // Wednesday
          { dayOfWeek: 5, workoutId: legWorkout.id }, // Friday
        ],
      },
    },
    select: { id: true },
  });

  // Current plan: started 2 weeks ago, runs for 8 weeks
  const currentPlanStart = addDays(thisMonday, -14);
  const currentPlanEnd = addDays(thisMonday, 42);

  const currentPlan = await db.plan.create({
    data: {
      ownerId: uid,
      name: "PPL Hypertrophy Phase (Current)",
      description: "8-week hypertrophy-focused cycle",
      startDate: currentPlanStart,
      endDate: currentPlanEnd,
      status: "ACTIVE",
      schedule: {
        create: [
          { dayOfWeek: 1, workoutId: pushWorkout.id },
          { dayOfWeek: 3, workoutId: pullWorkout.id },
          { dayOfWeek: 5, workoutId: legWorkout.id },
        ],
      },
    },
    select: { id: true },
  });

  // ── 6. Body metrics (span 16 weeks with progressive change toward 75kg goal)
  console.log("▸ Logging body metrics…");
  const bwMetrics = [
    { value: 85, daysBack: 112, note: "Start of old plan" },
    { value: 84.5, daysBack: 84 },
    { value: 84, daysBack: 56 },
    { value: 83.5, daysBack: 28 },
    { value: 83, daysBack: 14 },
    { value: 82.5, daysBack: 7 },
    { value: 81.5, daysBack: 0, note: "Today" },
  ];

  for (const m of bwMetrics) {
    await db.bodyMetric.create({
      data: {
        userId: uid,
        type: "BODYWEIGHT",
        value: m.value,
        date: utcMidnight(m.daysBack),
        note: m.note,
      },
    });
  }

  // ── 7. Goals (mix of achieved, in-progress, and behind)
  console.log("▸ Creating goals…");

  // Goal 1: Bodyweight loss (in progress, ~35% done)
  await db.goal.create({
    data: {
      userId: uid,
      type: "BODY_METRIC",
      title: "Reach 75 kg",
      targetDate: utcMidnight(-156), // Dec 1, 2026
      status: "ACTIVE",
      config: {
        metricType: "BODYWEIGHT",
        startingValue: 85,
        targetValue: 75,
      },
    },
  });

  // Goal 2: Bench Press 1RM (in progress, ~65% done)
  await db.goal.create({
    data: {
      userId: uid,
      type: "STRENGTH",
      title: "Bench Press: 115 kg",
      targetDate: utcMidnight(-60),
      status: "ACTIVE",
      config: {
        exerciseId: benchId,
        metric: "1RM",
        targetValueKg: 115,
        startingValueKg: 100,
      },
    },
  });

  // Goal 3: Consistency (achieved)
  await db.goal.create({
    data: {
      userId: uid,
      type: "CONSISTENCY",
      title: "Average 3 workouts per week",
      targetDate: utcMidnight(-90),
      status: "ACHIEVED",
      config: {
        workoutsPerWeek: 3,
      },
    },
  });

  // Goal 4: Squat 1RM (behind, ~45% done)
  await db.goal.create({
    data: {
      userId: uid,
      type: "STRENGTH",
      title: "Squat: 130 kg",
      targetDate: utcMidnight(-45),
      status: "ACTIVE",
      config: {
        exerciseId: squatId,
        metric: "1RM",
        targetValueKg: 130,
        startingValueKg: 105,
      },
    },
  });

  // ── 8. Session history (16 weeks back with progressive overload)
  console.log("▸ Logging 30+ sessions with progressive overload…");

  // Helper to generate sessions for old plan (PPL 3x/week for 8 weeks = 24 sessions)
  // With some missed sessions for realism
  const oldPlanWeeks = 8;
  for (let week = oldPlanWeeks; week >= 1; week--) {
    const weekMonday = addDays(oldPlanStart, (oldPlanWeeks - week) * 7);

    // Week weight progression: +2.5kg every 3 weeks
    const weeksPassed = oldPlanWeeks - week;
    const benchWeight = 75 + Math.floor(weeksPassed / 3) * 2.5;
    const squatWeight = 90 + Math.floor(weeksPassed / 3) * 2.5;
    const deadliftWeight = 105 + Math.floor(weeksPassed / 3) * 5;

    // Monday: Push
    if (week !== 5) {
      // Skip one random week for realism
      await logSession({
        userId: uid,
        workoutId: pushWorkout.id,
        planId: oldPlan.id,
        startedAt: atNoon(weekMonday),
        scheduledDate: weekMonday,
        durationMinutes: 58,
        effort: 7,
        exercises: [
          {
            exerciseId: benchId,
            sets: [
              { weightKg: benchWeight, reps: 5 },
              { weightKg: benchWeight, reps: 5 },
              { weightKg: benchWeight, reps: 5 },
              { weightKg: benchWeight, reps: 4 },
            ],
          },
          { exerciseId: ohpId, sets: [{ weightKg: 50, reps: 8 }] },
          { exerciseId: pushdownId, sets: [{ weightKg: 32.5, reps: 12 }] },
        ],
      });
    }

    // Wednesday: Pull
    const pullWed = addDays(weekMonday, 2);
    if (week !== 4) {
      await logSession({
        userId: uid,
        workoutId: pullWorkout.id,
        planId: oldPlan.id,
        startedAt: atNoon(pullWed),
        scheduledDate: pullWed,
        durationMinutes: 62,
        effort: 8,
        exercises: [
          {
            exerciseId: deadliftId,
            sets: [
              { weightKg: deadliftWeight, reps: 3 },
              { weightKg: deadliftWeight, reps: 3 },
              { weightKg: deadliftWeight, reps: 2 },
            ],
          },
          {
            exerciseId: rowId,
            sets: [{ weightKg: 80, reps: 6 }, { weightKg: 80, reps: 6 }],
          },
          { exerciseId: pullupId, sets: [{ reps: 8 }, { reps: 7 }] },
        ],
      });
    }

    // Friday: Leg
    const legFri = addDays(weekMonday, 4);
    await logSession({
      userId: uid,
      workoutId: legWorkout.id,
      planId: oldPlan.id,
      startedAt: atNoon(legFri),
      scheduledDate: legFri,
      durationMinutes: 65,
      effort: 8,
      exercises: [
        {
          exerciseId: squatId,
          sets: [
            { weightKg: squatWeight, reps: 5 },
            { weightKg: squatWeight, reps: 5 },
            { weightKg: squatWeight, reps: 5 },
            { weightKg: squatWeight, reps: 4 },
          ],
        },
        {
          exerciseId: legPressId,
          sets: [{ weightKg: 160, reps: 10 }, { weightKg: 160, reps: 8 }],
        },
        { exerciseId: rdlId, sets: [{ weightKg: 90, reps: 8 }] },
      ],
    });
  }

  // Current plan: PPL for 3 weeks with progressive overload
  const currentWeeks = 3;
  for (let week = 0; week < currentWeeks; week++) {
    const weekMonday = addDays(currentPlanStart, week * 7);

    // Progressive from old plan
    const benchWeight = 92.5 + week * 2.5;
    const squatWeight = 107.5 + week * 2.5;
    const deadliftWeight = 125 + week * 2.5;

    // Monday: Push
    await logSession({
      userId: uid,
      workoutId: pushWorkout.id,
      planId: currentPlan.id,
      startedAt: atNoon(weekMonday),
      scheduledDate: weekMonday,
      durationMinutes: 58,
      effort: 7,
      exercises: [
        {
          exerciseId: benchId,
          sets: [
            { weightKg: benchWeight, reps: 5 },
            { weightKg: benchWeight, reps: 5 },
            { weightKg: benchWeight, reps: 5 },
            { weightKg: benchWeight, reps: 4 },
          ],
        },
        { exerciseId: ohpId, sets: [{ weightKg: 52.5, reps: 8 }] },
        { exerciseId: pushdownId, sets: [{ weightKg: 35, reps: 12 }] },
      ],
    });

    // Wednesday: Pull
    const pullWed = addDays(weekMonday, 2);
    if (week === 0) {
      // Missed first pull session for adherence variation
      // (no session logged)
    } else if (week === 2) {
      // Missed this week's pull session (current week)
      // (no session logged)
    } else {
      await logSession({
        userId: uid,
        workoutId: pullWorkout.id,
        planId: currentPlan.id,
        startedAt: atNoon(pullWed),
        scheduledDate: pullWed,
        durationMinutes: 62,
        effort: 8,
        exercises: [
          {
            exerciseId: deadliftId,
            sets: [
              { weightKg: deadliftWeight, reps: 3 },
              { weightKg: deadliftWeight, reps: 3 },
              { weightKg: deadliftWeight, reps: 2 },
            ],
          },
          {
            exerciseId: rowId,
            sets: [
              { weightKg: 87.5, reps: 6 },
              { weightKg: 87.5, reps: 6 },
            ],
          },
          { exerciseId: pullupId, sets: [{ reps: 8 }, { reps: 7 }] },
        ],
      });
    }

    // Friday: Leg
    const legFri = addDays(weekMonday, 4);
    if (week < currentWeeks) {
      // Only log if this week hasn't happened yet
      await logSession({
        userId: uid,
        workoutId: legWorkout.id,
        planId: currentPlan.id,
        startedAt: atNoon(legFri),
        scheduledDate: legFri,
        durationMinutes: 65,
        effort: 8,
        exercises: [
          {
            exerciseId: squatId,
            sets: [
              { weightKg: squatWeight, reps: 5 },
              { weightKg: squatWeight, reps: 5 },
              { weightKg: squatWeight, reps: 5 },
              { weightKg: squatWeight, reps: 4 },
            ],
          },
          {
            exerciseId: legPressId,
            sets: [{ weightKg: 180, reps: 10 }, { weightKg: 180, reps: 8 }],
          },
          { exerciseId: rdlId, sets: [{ weightKg: 97.5, reps: 8 }] },
        ],
      });
    }
  }

  console.log("");
  console.log("✓ Rich dev seed complete!");
  console.log("  Email:    dev@health.local");
  console.log("  Password: password123");
  console.log("");
  console.log("  📊 Workouts (6):");
  console.log("    • Push Day (with tricep superset)");
  console.log("    • Pull Day (with row + pullup superset)");
  console.log("    • Leg Day (with leg press + curl superset)");
  console.log("    • Upper Body (bench + row superset)");
  console.log("    • Lower Body (RDL + leg press superset)");
  console.log("    • Full Body (compound focus)");
  console.log("");
  console.log("  📅 Plans:");
  console.log("    • Old PPL plan: 8 weeks, COMPLETED (16-8 weeks ago)");
  console.log("    • Current PPL: 8 weeks, ACTIVE (started 2 weeks ago)");
  console.log("");
  console.log("  🎯 Goals (4):");
  console.log("    • Bodyweight: 85kg → 75kg by Dec 1 (in progress, ~35%)");
  console.log("    • Bench 1RM: 100kg → 115kg (in progress, 65%)");
  console.log("    • Consistency: 3/week (achieved)");
  console.log("    • Squat 1RM: 105kg → 130kg (in progress, 45%)");
  console.log("");
  console.log("  📈 Sessions:");
  console.log("    • 32+ logged sessions spanning 16 weeks");
  console.log("    • Progressive overload: +2.5-5kg every 2-3 weeks");
  console.log("    • Body metrics: 8 bodyweight logs (85kg → 81.5kg, trending to 75kg)");
  console.log("    • Adherence: old plan ~75%, current plan 2 missed sessions (1 this week)");
  console.log("");
  console.log("  Ready to screenshot!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
