import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/internal/workouts/[id]/route";
import { createTestDb, seedTestUser, seedTestExercise } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-workouts-patch-id";

function makePatch(id: string, headers: Record<string, string>, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/internal/workouts/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authHeaders(userId: string) {
  return { "x-internal-secret": SECRET, "x-user-id": userId };
}

async function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PATCH /api/internal/workouts/[id]", () => {
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
    const res = await PATCH(
      makePatch(workoutId, { "x-user-id": userId }, { name: "New" }),
      { params: makeParams(workoutId) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for a workout belonging to a different user", async () => {
    const res = await PATCH(
      makePatch(workoutId, authHeaders(otherUserId), { name: "Stolen" }),
      { params: makeParams(workoutId) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when no fields are provided", async () => {
    const res = await PATCH(
      makePatch(workoutId, authHeaders(userId), {}),
      { params: makeParams(workoutId) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid exercise entry (missing exerciseId)", async () => {
    const res = await PATCH(
      makePatch(workoutId, authHeaders(userId), { exercises: [{ targetSets: 3 }] }),
      { params: makeParams(workoutId) },
    );
    expect(res.status).toBe(400);
  });

  it("updates name only — exercises untouched", async () => {
    const res = await PATCH(
      makePatch(workoutId, authHeaders(userId), { name: "Push Day (Heavy)" }),
      { params: makeParams(workoutId) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(workoutId);

    const workout = await db.workout.findUnique({ where: { id: workoutId } });
    expect(workout!.name).toBe("Push Day (Heavy)");

    const exercises = await db.workoutExercise.findMany({ where: { workoutId } });
    expect(exercises).toHaveLength(2);
  });

  it("replaces the entire exercise list when exercises is provided", async () => {
    const ex3 = await seedTestExercise(db, userId, "Incline Dumbbell Press");

    const res = await PATCH(
      makePatch(workoutId, authHeaders(userId), {
        exercises: [{ exerciseId: ex3.id, targetSets: 4, targetReps: 12 }],
      }),
      { params: makeParams(workoutId) },
    );
    expect(res.status).toBe(200);

    const exercises = await db.workoutExercise.findMany({ where: { workoutId } });
    expect(exercises).toHaveLength(1);
    expect(exercises[0].exerciseId).toBe(ex3.id);
    expect(exercises[0].order).toBe(0);
    expect(exercises[0].targetSets).toBe(4);

    // Name from the previous test is preserved since this call didn't include it.
    const workout = await db.workout.findUnique({ where: { id: workoutId } });
    expect(workout!.name).toBe("Push Day (Heavy)");
  });
});
