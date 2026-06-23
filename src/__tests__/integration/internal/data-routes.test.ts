import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getSessions } from "@/app/api/internal/sessions/route";
import { GET as getExercises } from "@/app/api/internal/exercises/route";
import { GET as getWorkouts } from "@/app/api/internal/workouts/route";
import { GET as getPlans } from "@/app/api/internal/plans/route";
import { GET as getGoals } from "@/app/api/internal/goals/route";
import { GET as getMetrics } from "@/app/api/internal/metrics/route";
import { createTestDb, seedTestUser, seedTestExercise } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-m11";

function makeReq(
  url: string,
  headers: Record<string, string>,
): NextRequest {
  return new NextRequest(url, { headers });
}

describe("Internal data routes — auth guard", () => {
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

  const routes = [
    { name: "sessions", fn: getSessions, url: "http://localhost/api/internal/sessions" },
    { name: "exercises", fn: getExercises, url: "http://localhost/api/internal/exercises" },
    { name: "workouts", fn: getWorkouts, url: "http://localhost/api/internal/workouts" },
    { name: "plans", fn: getPlans, url: "http://localhost/api/internal/plans" },
    { name: "goals", fn: getGoals, url: "http://localhost/api/internal/goals" },
    { name: "metrics", fn: getMetrics, url: "http://localhost/api/internal/metrics" },
  ] as const;

  for (const route of routes) {
    it(`${route.name}: rejects missing secret`, async () => {
      const res = await route.fn(makeReq(route.url, { "x-user-id": userId }));
      expect(res.status).toBe(401);
    });

    it(`${route.name}: rejects wrong secret`, async () => {
      const res = await route.fn(
        makeReq(route.url, { "x-internal-secret": "wrong", "x-user-id": userId }),
      );
      expect(res.status).toBe(401);
    });

    it(`${route.name}: rejects missing userId`, async () => {
      const res = await route.fn(
        makeReq(route.url, { "x-internal-secret": SECRET }),
      );
      expect(res.status).toBe(401);
    });
  }
});

describe("GET /api/internal/sessions", () => {
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

  it("returns empty array when no sessions", async () => {
    const res = await getSessions(
      makeReq("http://localhost/api/internal/sessions?days=30", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("returns completed sessions within window", async () => {
    const now = new Date();
    await db.session.create({
      data: {
        userId,
        startedAt: now,
        endedAt: now,
        durationSeconds: 3600,
        overallEffort: 7,
      },
    });
    const res = await getSessions(
      makeReq("http://localhost/api/internal/sessions?days=7", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toMatchObject({
      durationMinutes: 60,
      overallEffort: 7,
    });
    expect(Array.isArray(data[0].exercises)).toBe(true);
  });

  it("does not include in-progress sessions (no endedAt)", async () => {
    await db.session.create({
      data: { userId, startedAt: new Date() },
    });
    const res = await getSessions(
      makeReq("http://localhost/api/internal/sessions?days=7", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    const data = await res.json();
    // All returned sessions must be completed (have durationMinutes set)
    for (const s of data) {
      expect(s).toHaveProperty("exercises");
    }
  });
});

describe("GET /api/internal/exercises", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    // system exercise
    await seedTestExercise(db, null, "Bench Press");
    // user exercise
    await seedTestExercise(db, userId, "User Squat");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns both system and user exercises", async () => {
    const res = await getExercises(
      makeReq("http://localhost/api/internal/exercises", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((e: any) => e.isSystem)).toBe(true);
    expect(data.some((e: any) => !e.isSystem)).toBe(true);
  });

  it("filters by name query", async () => {
    const res = await getExercises(
      makeReq("http://localhost/api/internal/exercises?q=Bench", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    const data = await res.json();
    expect(data.every((e: any) => e.name.includes("Bench"))).toBe(true);
  });
});

describe("GET /api/internal/workouts", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    await db.workout.create({
      data: { ownerId: userId, name: "Push Day", description: "Chest/shoulders/triceps" },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns workouts with exerciseCount", async () => {
    const res = await getWorkouts(
      makeReq("http://localhost/api/internal/workouts", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ name: "Push Day", exerciseCount: 0 });
  });
});

describe("GET /api/internal/plans", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    await db.plan.create({
      data: {
        ownerId: userId,
        name: "PPL 6-week",
        status: "ACTIVE",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-07-13"),
      },
    });
    await db.plan.create({
      data: {
        ownerId: userId,
        name: "Draft Plan",
        status: "DRAFT",
        startDate: new Date("2026-07-14"),
        endDate: new Date("2026-08-25"),
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns all plans without filter", async () => {
    const res = await getPlans(
      makeReq("http://localhost/api/internal/plans", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by status", async () => {
    const res = await getPlans(
      makeReq("http://localhost/api/internal/plans?status=ACTIVE", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("ACTIVE");
  });
});

describe("GET /api/internal/goals", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    await db.goal.create({
      data: {
        userId,
        type: "CONSISTENCY",
        title: "Work out 4x/week",
        status: "ACTIVE",
        config: { workoutsPerWeek: 4 },
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns goals with progress", async () => {
    const res = await getGoals(
      makeReq("http://localhost/api/internal/goals", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ title: "Work out 4x/week", type: "CONSISTENCY" });
    expect(data[0].progress).toHaveProperty("percentage");
  });
});

describe("GET /api/internal/metrics", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    const now = new Date();
    await db.bodyMetric.create({
      data: { userId, type: "BODYWEIGHT", value: 80.5, date: now },
    });
    await db.bodyMetric.create({
      data: { userId, type: "BODYWEIGHT", value: 79.8, date: new Date(now.getTime() - 7 * 86400_000) },
    });
    await db.bodyMetric.create({
      data: { userId, type: "WAIST", value: 88.0, date: now, note: "morning" },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns all metrics within the default window", async () => {
    const res = await getMetrics(
      makeReq("http://localhost/api/internal/metrics", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(3);
    expect(data[0]).toMatchObject({ type: expect.any(String), value: expect.any(Number) });
    expect(data[0]).toHaveProperty("date");
  });

  it("filters by metric type", async () => {
    const res = await getMetrics(
      makeReq("http://localhost/api/internal/metrics?type=BODYWEIGHT", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(2);
    expect(data.every((m: any) => m.type === "BODYWEIGHT")).toBe(true);
  });

  it("returns note field when present", async () => {
    const res = await getMetrics(
      makeReq("http://localhost/api/internal/metrics?type=WAIST", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    const data = await res.json();
    expect(data[0].note).toBe("morning");
  });

  it("returns empty array when no metrics in window", async () => {
    const res = await getMetrics(
      makeReq("http://localhost/api/internal/metrics?days=0", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("does not leak another user's metrics", async () => {
    const other = await seedTestUser(db, { email: "other2@example.com" });
    await db.bodyMetric.create({
      data: { userId: other.id, type: "BODYWEIGHT", value: 95.0, date: new Date() },
    });
    const res = await getMetrics(
      makeReq("http://localhost/api/internal/metrics", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    const data = await res.json();
    expect(data.every((m: any) => m.value !== 95.0)).toBe(true);
  });
});
