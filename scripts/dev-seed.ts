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
  startedAt: Date;       // actual session time — use atNoon(date) for timezone safety
  scheduledDate: Date;   // UTC midnight of the planned occurrence date (for Tier-1 adherence matching)
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
  // A bare db.user.deleteMany() would cascade to owned exercises, but
  // WorkoutExercise/SessionExercise reference exercises with onDelete: Restrict,
  // so the cascade fails if those junction rows still exist. We clear leaf tables
  // first, exactly like the admin userDataDeletions() helper does.
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
      displayName: "Dev User",
      unitPreference: "KG",
      timezone: "America/New_York",
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
            { exerciseId: pushdownId, order: 3, targetSets: 3, targetReps: 12, targetWeightKg: 30,  restSeconds: 90  },
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
            { exerciseId: legPressId, order: 3, targetSets: 3, targetReps: 12, targetWeightKg: 120, restSeconds: 90  },
          ],
        },
      },
      select: { id: true },
    }),
  ]);

  // ── 5. Active PPL plan (Mon=Push, Wed=Pull, Fri=Leg).
  //
  //   The plan starts on the Monday of last week so the adherence section
  //   immediately shows a rich mix of completed, completed_late, missed,
  //   and upcoming occurrences regardless of which day the seed is run.
  //
  //   All dates are computed relative to the current ISO week:
  //     thisMonday  = start of the current week (Mon)
  //     prevMonday  = start of last week (Mon-7)
  //     prevWed     = Wed of last week (Mon-5)
  //     prevFri     = Fri of last week (Mon-3)
  //
  //   Occurrence outcomes:
  //     prevMonday  Push  →  completed     (Session A, on time)
  //     prevWed     Pull  →  completed_late (Session B, done 2 days late on prevFri)
  //     prevFri     Leg   →  completed     (Session C, on time — same day as B)
  //     thisMonday  Push  →  completed     (Session D, on time, +2.5 kg overload)
  //     thisWed     Pull  →  missed        (no session logged)
  //     thisFri     Leg   →  upcoming      (future occurrence)
  //
  //   This-week panel:  Mon ✓ Done | Wed ✗ Missed | Fri ○ Upcoming
  //   Overall:          4 done / 1 missed / adherence 80%
  console.log("▸ Creating plan…");
  const thisMonday = thisWeekMonday();
  const prevMonday = addDays(thisMonday, -7);
  const prevWed    = addDays(prevMonday,  2);
  const prevFri    = addDays(prevMonday,  4);

  const plan = await db.plan.create({
    data: {
      ownerId: uid,
      name: "PPL Strength Program",
      description: "6-week push/pull/legs with progressive overload",
      startDate: prevMonday,
      endDate: utcMidnight(-21), // 3 weeks from now
      status: "ACTIVE",
      schedule: {
        create: [
          { dayOfWeek: 1, workoutId: pushWorkout.id }, // Monday  → Push
          { dayOfWeek: 3, workoutId: pullWorkout.id }, // Wednesday → Pull
          { dayOfWeek: 5, workoutId: legWorkout.id  }, // Friday   → Leg
        ],
      },
    },
    select: { id: true },
  });

  // ── 6. Body metrics (starting weight + a small dip to show progress)
  console.log("▸ Logging body metrics…");
  await db.bodyMetric.createMany({
    data: [
      { userId: uid, type: "BODYWEIGHT", value: 80,   date: prevMonday,     note: "Start of program" },
      { userId: uid, type: "BODYWEIGHT", value: 79.5, date: utcMidnight(2), note: "Down half a kilo" },
    ],
  });

  // ── 7. Bodyweight goal (decrease 80 → 75 kg over 3 months)
  console.log("▸ Creating goal…");
  await db.goal.create({
    data: {
      userId: uid,
      type: "BODY_METRIC",
      title: "Reach 75 kg",
      targetDate: utcMidnight(-90), // 90 days from now
      status: "ACTIVE",
      config: {
        metricType: "BODYWEIGHT",
        startingValue: 80,
        targetValue: 75,
      },
    },
  });

  // ── 8. Four sessions with progressive overload + plan adherence markers.
  //   scheduledDate = UTC midnight of the planned occurrence date (used by the
  //   Tier-1 greedy matcher in getPlanAdherence for exact plan+date linking).
  //   startedAt     = noon UTC on the day the session actually happened
  //                   (noon UTC is the same calendar day for any realistic timezone).
  console.log("▸ Logging sessions…");

  // Session A — Push Day, last Monday (on time)
  await logSession({
    userId: uid, workoutId: pushWorkout.id, planId: plan.id,
    startedAt: atNoon(prevMonday), scheduledDate: prevMonday,
    durationMinutes: 55, effort: 7,
    exercises: [
      { exerciseId: benchId,    sets: [{ weightKg: 80, reps: 5 }, { weightKg: 80, reps: 5 }, { weightKg: 80, reps: 5 }, { weightKg: 80, reps: 4 }] },
      { exerciseId: ohpId,      sets: [{ weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }, { weightKg: 50, reps: 7 }] },
      { exerciseId: pushdownId, sets: [{ weightKg: 30, reps: 12 }, { weightKg: 30, reps: 12 }, { weightKg: 30, reps: 10 }] },
    ],
  });

  // Session B — Pull Day, scheduled last Wed but done on last Fri (+2 days → completed_late)
  await logSession({
    userId: uid, workoutId: pullWorkout.id, planId: plan.id,
    startedAt: atNoon(prevFri), scheduledDate: prevWed,
    durationMinutes: 60, effort: 8,
    exercises: [
      { exerciseId: rowId,      sets: [{ weightKg: 70, reps: 8 }, { weightKg: 70, reps: 8 }, { weightKg: 70, reps: 7 }, { weightKg: 70, reps: 6 }] },
      { exerciseId: pullupId,   sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }, { reps: 6 }] },
      { exerciseId: deadliftId, sets: [{ weightKg: 100, reps: 3 }, { weightKg: 100, reps: 3 }, { weightKg: 105, reps: 2 }] },
    ],
  });

  // Session C — Leg Day, last Friday (on time — same day as Session B's late pull)
  await logSession({
    userId: uid, workoutId: legWorkout.id, planId: plan.id,
    startedAt: atNoon(prevFri), scheduledDate: prevFri,
    durationMinutes: 65, effort: 8,
    exercises: [
      { exerciseId: squatId,    sets: [{ weightKg: 90, reps: 5 }, { weightKg: 90, reps: 5 }, { weightKg: 90, reps: 5 }, { weightKg: 90, reps: 4 }] },
      { exerciseId: rdlId,      sets: [{ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 7 }] },
      { exerciseId: legPressId, sets: [{ weightKg: 120, reps: 12 }, { weightKg: 120, reps: 12 }, { weightKg: 120, reps: 10 }] },
    ],
  });

  // Session D — Push Day, this Monday (+2.5 kg progressive overload on bench + OHP)
  await logSession({
    userId: uid, workoutId: pushWorkout.id, planId: plan.id,
    startedAt: atNoon(thisMonday), scheduledDate: thisMonday,
    durationMinutes: 58, effort: 7,
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
  console.log("  Adherence preview:");
  console.log("    This week:  Mon ✓ Done | Wed ✗ Missed | Fri ○ Upcoming");
  console.log("    Overall:    ~80% (4 done, 1 missed, upcoming remaining)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
