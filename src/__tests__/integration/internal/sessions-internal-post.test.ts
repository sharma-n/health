import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/internal/sessions/route";
import { createTestDb, seedTestUser, seedTestExercise } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-sessions-post";

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

const URL = "http://localhost/api/internal/sessions";

describe("POST /api/internal/sessions", () => {
  let db: PrismaClient;
  let userId: string;
  let otherUserId: string;
  let exerciseId: string;
  let exercise2Id: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;

    const user = await seedTestUser(db);
    userId = user.id;
    const other = await seedTestUser(db, { email: "other2@example.com" });
    otherUserId = other.id;

    const ex = await seedTestExercise(db, userId, "Bench Press");
    exerciseId = ex.id;
    const ex2 = await seedTestExercise(db, userId, "Row");
    exercise2Id = ex2.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await POST(
      makePost(URL, { "x-user-id": userId }, { date: "2026-06-24", exercises: [] }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects missing date", async () => {
    const res = await POST(
      makePost(URL, authHeaders(userId), {
        exercises: [{ exerciseId, sets: [{ reps: 8 }] }],
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
    expect(data.fieldErrors).toHaveProperty("date");
  });

  it("rejects empty exercises array", async () => {
    const res = await POST(
      makePost(URL, authHeaders(userId), { date: "2026-06-24", exercises: [] }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
    expect(data.fieldErrors).toHaveProperty("exercises");
  });

  it("rejects exercise with no sets", async () => {
    const res = await POST(
      makePost(URL, authHeaders(userId), {
        date: "2026-06-24",
        exercises: [{ exerciseId, sets: [] }],
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("rejects overallEffort out of range", async () => {
    const res = await POST(
      makePost(URL, authHeaders(userId), {
        date: "2026-06-24",
        overallEffort: 11,
        exercises: [{ exerciseId, sets: [{ reps: 8 }] }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates session with exercises and sets", async () => {
    const res = await POST(
      makePost(URL, authHeaders(userId), {
        date: "2026-06-24",
        exercises: [
          {
            exerciseId,
            sets: [
              { weightKg: 80, reps: 8 },
              { weightKg: 80, reps: 8 },
              { weightKg: 82.5, reps: 6 },
            ],
          },
          {
            exerciseId: exercise2Id,
            sets: [{ weightKg: 60, reps: 10 }],
          },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("id");

    const session = await db.session.findUnique({
      where: { id: data.id },
      include: { exercises: { include: { sets: true }, orderBy: { order: "asc" } } },
    });
    expect(session).not.toBeNull();
    expect(session!.userId).toBe(userId);
    expect(session!.endedAt).not.toBeNull();
    expect(session!.startedAt.toISOString()).toBe(session!.endedAt!.toISOString());
    expect(session!.exercises).toHaveLength(2);
    expect(session!.exercises[0].order).toBe(0);
    expect(session!.exercises[1].order).toBe(1);
    expect(session!.exercises[0].sets).toHaveLength(3);
    expect(session!.exercises[0].sets[0].setNumber).toBe(1);
    expect(session!.exercises[0].sets[1].setNumber).toBe(2);
    expect(session!.exercises[0].sets[2].setNumber).toBe(3);
    expect(session!.exercises[0].sets[0].completed).toBe(true);
    expect(session!.exercises[0].sets[0].weightKg).toBe(80);
    expect(session!.exercises[0].sets[0].reps).toBe(8);
  });

  it("saves overallEffort and notes", async () => {
    const res = await POST(
      makePost(URL, authHeaders(userId), {
        date: "2026-06-23",
        overallEffort: 8,
        notes: "Good session",
        exercises: [{ exerciseId, sets: [{ reps: 5 }] }],
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const session = await db.session.findUnique({ where: { id: data.id } });
    expect(session!.overallEffort).toBe(8);
    expect(session!.notes).toBe("Good session");
  });

  it("rejects workoutId belonging to another user", async () => {
    const otherWorkout = await db.workout.create({
      data: { ownerId: otherUserId, name: "Other Workout" },
      select: { id: true },
    });

    const res = await POST(
      makePost(URL, authHeaders(userId), {
        date: "2026-06-24",
        workoutId: otherWorkout.id,
        exercises: [{ exerciseId, sets: [{ reps: 8 }] }],
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Workout not found");
  });

  it("links session to owned workoutId", async () => {
    const workout = await db.workout.create({
      data: { ownerId: userId, name: "My Workout" },
      select: { id: true },
    });

    const res = await POST(
      makePost(URL, authHeaders(userId), {
        date: "2026-06-22",
        workoutId: workout.id,
        exercises: [{ exerciseId, sets: [{ reps: 8 }] }],
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const session = await db.session.findUnique({ where: { id: data.id } });
    expect(session!.workoutId).toBe(workout.id);
  });
});
