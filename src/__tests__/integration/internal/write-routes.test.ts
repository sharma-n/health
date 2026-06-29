import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as postWorkout } from "@/app/api/internal/workouts/route";
import { POST as postPlan } from "@/app/api/internal/plans/route";
import { POST as postGoal } from "@/app/api/internal/goals/route";
import { POST as postMetric } from "@/app/api/internal/metrics/route";
import { POST as postExercise } from "@/app/api/internal/exercises/route";
import { createTestDb, seedTestUser, seedTestExercise } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-m13-write";

function makePost(url: string, headers: Record<string, string>, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authHeaders(userId: string) {
  return { "x-internal-secret": SECRET, "x-user-id": userId };
}

// ---------------------------------------------------------------------------
// POST /api/internal/workouts
// ---------------------------------------------------------------------------

describe("POST /api/internal/workouts", () => {
  let db: PrismaClient;
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    const ex = await seedTestExercise(db, userId, "Bench Press");
    exerciseId = ex.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await postWorkout(
      makePost("http://localhost/api/internal/workouts", { "x-user-id": userId }, { name: "X" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects bad secret", async () => {
    const res = await postWorkout(
      makePost(
        "http://localhost/api/internal/workouts",
        { "x-internal-secret": "bad", "x-user-id": userId },
        { name: "X" },
      ),
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid body — missing name", async () => {
    const res = await postWorkout(
      makePost("http://localhost/api/internal/workouts", authHeaders(userId), { exercises: [] }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("creates a workout with exercises", async () => {
    const body = {
      name: "Push Day",
      description: "Chest and triceps",
      exercises: [
        { exerciseId, targetSets: 3, targetReps: 8, targetWeightKg: 80 },
      ],
    };
    const res = await postWorkout(
      makePost("http://localhost/api/internal/workouts", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");

    // Verify DB state
    const workout = await db.workout.findUnique({
      where: { id: data.id },
      include: { exercises: true },
    });
    expect(workout).not.toBeNull();
    expect(workout!.name).toBe("Push Day");
    expect(workout!.exercises).toHaveLength(1);
    expect(workout!.exercises[0].order).toBe(0);
    expect(workout!.exercises[0].targetSets).toBe(3);
  });

  it("creates a workout with no exercises", async () => {
    const res = await postWorkout(
      makePost("http://localhost/api/internal/workouts", authHeaders(userId), { name: "Empty" }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");
  });
});

// ---------------------------------------------------------------------------
// POST /api/internal/plans
// ---------------------------------------------------------------------------

describe("POST /api/internal/plans", () => {
  let db: PrismaClient;
  let userId: string;
  let workoutId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    const workout = await db.workout.create({
      data: { ownerId: userId, name: "Push Day" },
    });
    workoutId = workout.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await postPlan(
      makePost("http://localhost/api/internal/plans", { "x-user-id": userId }, {}),
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid body — missing name", async () => {
    const res = await postPlan(
      makePost("http://localhost/api/internal/plans", authHeaders(userId), {
        startDate: "2026-07-01",
        endDate: "2026-08-31",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects endDate before startDate", async () => {
    const res = await postPlan(
      makePost("http://localhost/api/internal/plans", authHeaders(userId), {
        name: "Bad Plan",
        startDate: "2026-08-31",
        endDate: "2026-07-01",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects schedule with unowned workoutId", async () => {
    const res = await postPlan(
      makePost("http://localhost/api/internal/plans", authHeaders(userId), {
        name: "Sneaky Plan",
        startDate: "2026-07-01",
        endDate: "2026-08-31",
        schedule: [{ dayOfWeek: 1, workoutId: "foreign-id" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a plan with schedule and forces DRAFT status", async () => {
    const body = {
      name: "PPL 8-Week",
      startDate: "2026-07-01",
      endDate: "2026-08-25",
      status: "ACTIVE", // should be overridden to DRAFT
      schedule: [{ dayOfWeek: 1, workoutId }],
    };
    const res = await postPlan(
      makePost("http://localhost/api/internal/plans", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");

    const plan = await db.plan.findUnique({
      where: { id: data.id },
      include: { schedule: true },
    });
    expect(plan).not.toBeNull();
    expect(plan!.status).toBe("DRAFT");
    expect(plan!.schedule).toHaveLength(1);
    expect(plan!.schedule[0].dayOfWeek).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/internal/goals
// ---------------------------------------------------------------------------

describe("POST /api/internal/goals", () => {
  let db: PrismaClient;
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    const ex = await seedTestExercise(db, userId, "Squat");
    exerciseId = ex.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await postGoal(
      makePost("http://localhost/api/internal/goals", { "x-user-id": userId }, {}),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unknown goal type", async () => {
    const res = await postGoal(
      makePost("http://localhost/api/internal/goals", authHeaders(userId), {
        title: "Bad",
        type: "UNKNOWN",
        config: {},
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a CONSISTENCY goal", async () => {
    const body = {
      title: "Train 3x/week",
      type: "CONSISTENCY",
      config: { workoutsPerWeek: 3 },
    };
    const res = await postGoal(
      makePost("http://localhost/api/internal/goals", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");

    const goal = await db.goal.findUnique({ where: { id: data.id } });
    expect(goal).not.toBeNull();
    expect(goal!.type).toBe("CONSISTENCY");
    expect(goal!.status).toBe("ACTIVE");
    expect(goal!.title).toBe("Train 3x/week");
  });

  it("creates a BODY_METRIC goal", async () => {
    const body = {
      title: "Lose 5 kg",
      type: "BODY_METRIC",
      targetDate: "2026-12-31",
      config: { metricType: "BODYWEIGHT", startingValue: 80, targetValue: 75 },
    };
    const res = await postGoal(
      makePost("http://localhost/api/internal/goals", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const goal = await db.goal.findUnique({ where: { id: data.id } });
    expect(goal!.type).toBe("BODY_METRIC");
    expect((goal!.config as any).targetValue).toBe(75);
  });

  it("creates a STRENGTH goal", async () => {
    const body = {
      title: "Squat 140 kg",
      type: "STRENGTH",
      config: { exerciseId, metric: "1RM", targetValueKg: 140, startingValueKg: 100 },
    };
    const res = await postGoal(
      makePost("http://localhost/api/internal/goals", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const goal = await db.goal.findUnique({ where: { id: data.id } });
    expect(goal!.type).toBe("STRENGTH");
  });

  it("rejects STRENGTH goal with missing config fields", async () => {
    const res = await postGoal(
      makePost("http://localhost/api/internal/goals", authHeaders(userId), {
        title: "Bad strength goal",
        type: "STRENGTH",
        config: { metric: "1RM" }, // missing exerciseId, targetValueKg
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/internal/metrics
// ---------------------------------------------------------------------------

describe("POST /api/internal/metrics", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await postMetric(
      makePost("http://localhost/api/internal/metrics", { "x-user-id": userId }, {}),
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid metric type", async () => {
    const res = await postMetric(
      makePost("http://localhost/api/internal/metrics", authHeaders(userId), {
        type: "INVALID_TYPE",
        value: 80,
        date: "2026-06-23",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects non-positive value", async () => {
    const res = await postMetric(
      makePost("http://localhost/api/internal/metrics", authHeaders(userId), {
        type: "BODYWEIGHT",
        value: -5,
        date: "2026-06-23",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a body metric", async () => {
    const body = { type: "BODYWEIGHT", value: 79.5, date: "2026-06-23" };
    const res = await postMetric(
      makePost("http://localhost/api/internal/metrics", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");

    const metric = await db.bodyMetric.findUnique({ where: { id: data.id } });
    expect(metric).not.toBeNull();
    expect(metric!.value).toBe(79.5);
    expect(metric!.type).toBe("BODYWEIGHT");
    expect(metric!.userId).toBe(userId);
  });

  it("creates a metric with note", async () => {
    const body = { type: "WAIST", value: 85, date: "2026-06-23", note: "Morning measurement" };
    const res = await postMetric(
      makePost("http://localhost/api/internal/metrics", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const metric = await db.bodyMetric.findUnique({ where: { id: data.id } });
    expect(metric!.note).toBe("Morning measurement");
  });
});

// ---------------------------------------------------------------------------
// POST /api/internal/exercises
// ---------------------------------------------------------------------------

describe("POST /api/internal/exercises", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await postExercise(
      makePost("http://localhost/api/internal/exercises", { "x-user-id": userId }, {}),
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid body — missing equipment", async () => {
    const res = await postExercise(
      makePost("http://localhost/api/internal/exercises", authHeaders(userId), {
        name: "No Equipment Exercise",
        primaryMuscles: ["CHEST"],
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("rejects missing primaryMuscles", async () => {
    const res = await postExercise(
      makePost("http://localhost/api/internal/exercises", authHeaders(userId), {
        name: "Bad Exercise",
        equipment: "BARBELL",
        primaryMuscles: [],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates an exercise with required fields only", async () => {
    const body = {
      name: "Banded Pull-Apart",
      equipment: "BAND",
      primaryMuscles: ["UPPER_BACK", "REAR_DELTS"],
    };
    const res = await postExercise(
      makePost("http://localhost/api/internal/exercises", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");

    const exercise = await db.exercise.findUnique({ where: { id: data.id } });
    expect(exercise).not.toBeNull();
    expect(exercise!.name).toBe("Banded Pull-Apart");
    expect(exercise!.equipment).toBe("BAND");
    expect(exercise!.isSystem).toBe(false);
    expect(exercise!.ownerId).toBe(userId);
    expect(exercise!.isArchived).toBe(false);
  });

  it("creates an exercise with all optional fields", async () => {
    const body = {
      name: "Floor Press",
      equipment: "BARBELL",
      primaryMuscles: ["CHEST"],
      secondaryMuscles: ["TRICEPS"],
      description: "A chest press done lying on the floor",
      instructions: "Lie flat on the floor...",
      commonPitfalls: "Don't flare the elbows.",
    };
    const res = await postExercise(
      makePost("http://localhost/api/internal/exercises", authHeaders(userId), body),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const exercise = await db.exercise.findUnique({ where: { id: data.id } });
    expect(exercise!.description).toBe("A chest press done lying on the floor");
    expect(exercise!.instructions).toBe("Lie flat on the floor...");
    expect(exercise!.commonPitfalls).toBe("Don't flare the elbows.");
  });
});
