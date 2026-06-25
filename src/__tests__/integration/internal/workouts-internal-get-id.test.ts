import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/internal/workouts/[id]/route";
import { createTestDb, seedTestUser, seedTestExercise } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-workouts-get-id";

function makeGet(id: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost/api/internal/workouts/${id}`, {
    method: "GET",
    headers,
  });
}

function authHeaders(userId: string) {
  return { "x-internal-secret": SECRET, "x-user-id": userId };
}

async function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("GET /api/internal/workouts/[id]", () => {
  let db: PrismaClient;
  let userId: string;
  let otherUserId: string;
  let exerciseId1: string;
  let exerciseId2: string;
  let workoutId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;

    const user = await seedTestUser(db);
    userId = user.id;
    const other = await seedTestUser(db, { email: "other@example.com" });
    otherUserId = other.id;

    const ex1 = await seedTestExercise(db, userId, "Bench Press");
    exerciseId1 = ex1.id;
    const ex2 = await seedTestExercise(db, userId, "Overhead Press");
    exerciseId2 = ex2.id;

    const workout = await db.workout.create({
      data: {
        ownerId: userId,
        name: "Push Day",
        exercises: {
          createMany: {
            data: [
              { exerciseId: exerciseId1, order: 0, targetSets: 3, targetReps: 8, targetWeightKg: 80 },
              { exerciseId: exerciseId2, order: 1, targetSets: 3, targetReps: 10, targetWeightKg: 50 },
            ],
          },
        },
      },
      select: { id: true },
    });
    workoutId = workout.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await GET(makeGet(workoutId, { "x-user-id": userId }), { params: makeParams(workoutId) });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown id", async () => {
    const res = await GET(makeGet("nonexistent", authHeaders(userId)), { params: makeParams("nonexistent") });
    expect(res.status).toBe(404);
  });

  it("returns 404 for another user's workout", async () => {
    const res = await GET(makeGet(workoutId, authHeaders(otherUserId)), { params: makeParams(workoutId) });
    expect(res.status).toBe(404);
  });

  it("returns workout with exercises ordered by order field", async () => {
    const res = await GET(makeGet(workoutId, authHeaders(userId)), { params: makeParams(workoutId) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe(workoutId);
    expect(data.name).toBe("Push Day");
    expect(data.exercises).toHaveLength(2);

    expect(data.exercises[0].exerciseId).toBe(exerciseId1);
    expect(data.exercises[0].name).toBe("Bench Press");
    expect(data.exercises[0].targetSets).toBe(3);
    expect(data.exercises[0].targetReps).toBe(8);
    expect(data.exercises[0].targetWeightKg).toBe(80);
    expect(data.exercises[0].order).toBe(0);

    expect(data.exercises[1].exerciseId).toBe(exerciseId2);
    expect(data.exercises[1].name).toBe("Overhead Press");
    expect(data.exercises[1].order).toBe(1);
  });
});
