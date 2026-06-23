import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as getAdherence } from "@/app/api/internal/analytics/adherence/route";
import { GET as getPrs } from "@/app/api/internal/analytics/prs/route";
import { GET as getProgression } from "@/app/api/internal/analytics/progression/route";
import { GET as getMuscleVolume } from "@/app/api/internal/analytics/muscle-volume/route";
import { createTestDb, seedTestUser, seedTestExercise } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-analytics";

function makeReq(url: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(url, { headers });
}

describe("Internal analytics routes — auth guard", () => {
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
    { name: "adherence", fn: getAdherence, url: "http://localhost/api/internal/analytics/adherence" },
    { name: "prs", fn: getPrs, url: "http://localhost/api/internal/analytics/prs" },
    { name: "progression", fn: getProgression, url: "http://localhost/api/internal/analytics/progression?exerciseId=abc" },
    { name: "muscle-volume", fn: getMuscleVolume, url: "http://localhost/api/internal/analytics/muscle-volume" },
  ] as const;

  for (const route of routes) {
    it(`${route.name}: rejects missing secret`, async () => {
      const res = await route.fn(makeReq(route.url, { "x-user-id": userId }));
      expect(res.status).toBe(401);
    });

    it(`${route.name}: rejects wrong secret`, async () => {
      const res = await route.fn(
        makeReq(route.url, { "x-internal-secret": "bad", "x-user-id": userId }),
      );
      expect(res.status).toBe(401);
    });
  }
});

describe("GET /api/internal/analytics/adherence", () => {
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

  it("returns adherence stats shape", async () => {
    const res = await getAdherence(
      makeReq("http://localhost/api/internal/analytics/adherence", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("currentStreak");
    expect(data).toHaveProperty("totalCompleted");
    expect(Array.isArray(data.heatmapData)).toBe(true);
  });
});

describe("GET /api/internal/analytics/prs", () => {
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

  it("returns empty array when no training data", async () => {
    const res = await getPrs(
      makeReq("http://localhost/api/internal/analytics/prs", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("GET /api/internal/analytics/progression", () => {
  let db: PrismaClient;
  let userId: string;
  let exerciseId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;
    const ex = await seedTestExercise(db, userId, "Test Deadlift");
    exerciseId = ex.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns 400 when exerciseId missing", async () => {
    const res = await getProgression(
      makeReq("http://localhost/api/internal/analytics/progression", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns progression data for valid exerciseId", async () => {
    const res = await getProgression(
      makeReq(
        `http://localhost/api/internal/analytics/progression?exerciseId=${exerciseId}`,
        { "x-internal-secret": SECRET, "x-user-id": userId },
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("GET /api/internal/analytics/muscle-volume", () => {
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

  it("returns muscle volume data shape", async () => {
    const res = await getMuscleVolume(
      makeReq("http://localhost/api/internal/analytics/muscle-volume?weeks=4", {
        "x-internal-secret": SECRET,
        "x-user-id": userId,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("weeks");
    expect(Array.isArray(data.weeks)).toBe(true);
  });
});
