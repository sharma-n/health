// Dev-seed script — resets all user accounts and populates a demo account with
// realistic workouts, sessions, a plan, and a goal so the app is immediately
// usable after a database wipe.
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

// Returns a Date that is `n` days in the past (negative n = future).
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
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
  daysBack: number;
  durationMinutes: number;
  effort: number;
  exercises: Array<{
    exerciseId: string;
    sets: Array<{ weightKg?: number; reps?: number }>;
  }>;
}) {
  const startedAt = daysAgo(opts.daysBack);
  const endedAt = new Date(startedAt.getTime() + opts.durationMinutes * 60 * 1000);

  const session = await db.session.create({
    data: {
      userId: opts.userId,
      workoutId: opts.workoutId,
      planId: opts.planId,
      scheduledDate: startedAt,
      startedAt,
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
  // ── 1. Wipe all user accounts (cascades to all user-scoped data)
  console.log("▸ Deleting all user accounts…");
  await db.user.deleteMany();

  // ── 2. Demo user
  console.log("▸ Creating demo user dev@health.local / password123");
  const hash = await bcrypt.hash("password123", 12);
  const user = await db.user.create({
    data: {
      email: "dev@health.local",
      passwordHash: hash,
      displayName: "Dev User",
      unitPreference: "KG",
      isAdmin: true,
      onboardingComplete: true,
    },
    select: { id: true },
  });
  const uid = user.id;

  // ── 3. Look up the system exercises we'll use
  const [
    benchId, ohpId, pushdownId,
    rowId, pullupId, deadliftId,
    squatId, rdlId, legPressId,
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
  ]);

  // ── 4. Workout templates
  console.log("▸ Creating workouts…");
  const [pushWorkout, pullWorkout, legWorkout] = await Promise.all([
    db.workout.create({
      data: {
        ownerId: uid,
        name: "Push Day",
        description: "Chest, shoulders, triceps",
        exercises: {
          create: [
            { exerciseId: benchId,    order: 1, targetSets: 4, targetReps: 5,  targetWeightKg: 80,  restSeconds: 180 },
            { exerciseId: ohpId,      order: 2, targetSets: 3, targetReps: 8,  targetWeightKg: 50,  restSeconds: 120 },
            { exerciseId: pushdownId, order: 3, targetSets: 3, targetReps: 12, targetWeightKg: 30,  restSeconds: 90 },
          ],
        },
      },
      select: { id: true },
    }),
    db.workout.create({
      data: {
        ownerId: uid,
        name: "Pull Day",
        description: "Back, biceps",
        exercises: {
          create: [
            { exerciseId: rowId,      order: 1, targetSets: 4, targetReps: 8, targetWeightKg: 70,  restSeconds: 180 },
            { exerciseId: pullupId,   order: 2, targetSets: 4, targetReps: 8,                      restSeconds: 120 },
            { exerciseId: deadliftId, order: 3, targetSets: 3, targetReps: 3, targetWeightKg: 100, restSeconds: 240 },
          ],
        },
      },
      select: { id: true },
    }),
    db.workout.create({
      data: {
        ownerId: uid,
        name: "Leg Day",
        description: "Quads, hamstrings, glutes",
        exercises: {
          create: [
            { exerciseId: squatId,    order: 1, targetSets: 4, targetReps: 5,  targetWeightKg: 90,  restSeconds: 240 },
            { exerciseId: rdlId,      order: 2, targetSets: 3, targetReps: 8,  targetWeightKg: 80,  restSeconds: 180 },
            { exerciseId: legPressId, order: 3, targetSets: 3, targetReps: 12, targetWeightKg: 120, restSeconds: 90 },
          ],
        },
      },
      select: { id: true },
    }),
  ]);

  // ── 5. Active PPL plan (started 3 weeks ago, runs 6 weeks total)
  console.log("▸ Creating plan…");
  const plan = await db.plan.create({
    data: {
      ownerId: uid,
      name: "PPL Strength Program",
      description: "6-week push/pull/legs with progressive overload",
      startDate: daysAgo(21),
      endDate: daysAgo(-21), // 21 days from now
      status: "ACTIVE",
      schedule: {
        create: [
          { dayOfWeek: 1, workoutId: pushWorkout.id }, // Monday
          { dayOfWeek: 3, workoutId: pullWorkout.id }, // Wednesday
          { dayOfWeek: 5, workoutId: legWorkout.id  }, // Friday
        ],
      },
    },
    select: { id: true },
  });

  // ── 6. Body metrics (starting weight + a small dip to show progress)
  console.log("▸ Logging body metrics…");
  await db.bodyMetric.createMany({
    data: [
      { userId: uid, type: "BODYWEIGHT", value: 80,   date: daysAgo(15), note: "Start of program" },
      { userId: uid, type: "BODYWEIGHT", value: 79.5, date: daysAgo(5),  note: "Down half a kilo" },
    ],
  });

  // ── 7. Bodyweight goal (decrease 80 → 75 kg)
  console.log("▸ Creating goal…");
  await db.goal.create({
    data: {
      userId: uid,
      type: "BODY_METRIC",
      title: "Reach 75 kg",
      targetDate: daysAgo(-90), // 90 days from now
      status: "ACTIVE",
      config: {
        metricType: "BODYWEIGHT",
        startingValue: 80,
        targetValue: 75,
      },
    },
  });

  // ── 8. Four completed sessions with progressive overload
  console.log("▸ Logging sessions…");

  // Session 1 — Push (14 days ago)
  await logSession({
    userId: uid, workoutId: pushWorkout.id, planId: plan.id,
    daysBack: 14, durationMinutes: 55, effort: 7,
    exercises: [
      { exerciseId: benchId,    sets: [{ weightKg: 80, reps: 5 }, { weightKg: 80, reps: 5 }, { weightKg: 80, reps: 5 }, { weightKg: 80, reps: 4 }] },
      { exerciseId: ohpId,      sets: [{ weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }, { weightKg: 50, reps: 7 }] },
      { exerciseId: pushdownId, sets: [{ weightKg: 30, reps: 12 }, { weightKg: 30, reps: 12 }, { weightKg: 30, reps: 10 }] },
    ],
  });

  // Session 2 — Pull (11 days ago)
  await logSession({
    userId: uid, workoutId: pullWorkout.id, planId: plan.id,
    daysBack: 11, durationMinutes: 60, effort: 8,
    exercises: [
      { exerciseId: rowId,      sets: [{ weightKg: 70, reps: 8 }, { weightKg: 70, reps: 8 }, { weightKg: 70, reps: 7 }, { weightKg: 70, reps: 6 }] },
      { exerciseId: pullupId,   sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }, { reps: 6 }] },
      { exerciseId: deadliftId, sets: [{ weightKg: 100, reps: 3 }, { weightKg: 100, reps: 3 }, { weightKg: 105, reps: 2 }] },
    ],
  });

  // Session 3 — Legs (7 days ago)
  await logSession({
    userId: uid, workoutId: legWorkout.id, planId: plan.id,
    daysBack: 7, durationMinutes: 65, effort: 8,
    exercises: [
      { exerciseId: squatId,    sets: [{ weightKg: 90, reps: 5 }, { weightKg: 90, reps: 5 }, { weightKg: 90, reps: 5 }, { weightKg: 90, reps: 4 }] },
      { exerciseId: rdlId,      sets: [{ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 7 }] },
      { exerciseId: legPressId, sets: [{ weightKg: 120, reps: 12 }, { weightKg: 120, reps: 12 }, { weightKg: 120, reps: 10 }] },
    ],
  });

  // Session 4 — Push again (3 days ago, +2.5 kg progressive overload on bench + OHP)
  await logSession({
    userId: uid, workoutId: pushWorkout.id, planId: plan.id,
    daysBack: 3, durationMinutes: 58, effort: 7,
    exercises: [
      { exerciseId: benchId,    sets: [{ weightKg: 82.5, reps: 5 }, { weightKg: 82.5, reps: 5 }, { weightKg: 82.5, reps: 5 }, { weightKg: 82.5, reps: 4 }] },
      { exerciseId: ohpId,      sets: [{ weightKg: 52.5, reps: 8 }, { weightKg: 52.5, reps: 7 }, { weightKg: 52.5, reps: 7 }] },
      { exerciseId: pushdownId, sets: [{ weightKg: 32.5, reps: 12 }, { weightKg: 32.5, reps: 12 }, { weightKg: 32.5, reps: 11 }] },
    ],
  });

  console.log("");
  console.log("✓ Dev seed complete.");
  console.log("  Email:    dev@health.local");
  console.log("  Password: password123");
  console.log("  Data:     3 workouts, PPL plan (active), bodyweight goal, 4 sessions");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
