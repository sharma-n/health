import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/internal/sessions/start/route";
import { GET } from "@/app/api/internal/sessions/route";
import { createTestDb, seedTestUser, seedTestExercise } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-sessions-start";

function makePost(url: string, headers: Record<string, string>, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeGet(url: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(url, { method: "GET", headers });
}

function authHeaders(userId: string) {
  return { "x-internal-secret": SECRET, "x-user-id": userId };
}

const URL = "http://localhost/api/internal/sessions/start";
const SESSIONS_URL = "http://localhost/api/internal/sessions";

describe("POST /api/internal/sessions/start", () => {
  let db: PrismaClient;
  let userId: string;
  let otherUserId: string;
  let exerciseId1: string;
  let exerciseId2: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;

    const user = await seedTestUser(db);
    userId = user.id;
    const other = await seedTestUser(db, { email: "other3@example.com" });
    otherUserId = other.id;

    const ex1 = await seedTestExercise(db, userId, "Squat");
    exerciseId1 = ex1.id;
    const ex2 = await seedTestExercise(db, userId, "Deadlift");
    exerciseId2 = ex2.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await POST(makePost(URL, { "x-user-id": userId }, {}));
    expect(res.status).toBe(401);
  });

  it("creates session with no exercises when exerciseIds omitted", async () => {
    const res = await POST(makePost(URL, authHeaders(userId), {}));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty("sessionId");
    expect(data).toHaveProperty("sessionUrl");
    expect(data.sessionUrl).toContain("/sessions/");

    const session = await db.session.findUnique({
      where: { id: data.sessionId },
      include: { exercises: true },
    });
    expect(session).not.toBeNull();
    expect(session!.endedAt).toBeNull();
    expect(session!.exercises).toHaveLength(0);
  });

  it("creates session with pre-populated exercises in order", async () => {
    const res = await POST(
      makePost(URL, authHeaders(userId), {
        exerciseIds: [exerciseId1, exerciseId2],
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const session = await db.session.findUnique({
      where: { id: data.sessionId },
      include: { exercises: { orderBy: { order: "asc" } } },
    });
    expect(session!.exercises).toHaveLength(2);
    expect(session!.exercises[0].exerciseId).toBe(exerciseId1);
    expect(session!.exercises[0].order).toBe(0);
    expect(session!.exercises[1].exerciseId).toBe(exerciseId2);
    expect(session!.exercises[1].order).toBe(1);
  });

  it("rejects workoutId belonging to another user", async () => {
    const otherWorkout = await db.workout.create({
      data: { ownerId: otherUserId, name: "Other Workout" },
      select: { id: true },
    });

    const res = await POST(
      makePost(URL, authHeaders(userId), { workoutId: otherWorkout.id }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Workout not found");
  });

  it("links session to owned workoutId and sets endedAt null", async () => {
    const workout = await db.workout.create({
      data: { ownerId: userId, name: "Legs Day" },
      select: { id: true },
    });

    const res = await POST(
      makePost(URL, authHeaders(userId), {
        workoutId: workout.id,
        exerciseIds: [exerciseId1],
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();

    const session = await db.session.findUnique({ where: { id: data.sessionId } });
    expect(session!.workoutId).toBe(workout.id);
    expect(session!.endedAt).toBeNull();
  });

  it("in-progress session does not appear in completed sessions GET", async () => {
    const res = await POST(makePost(URL, authHeaders(userId), {}));
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();

    const getRes = await GET(makeGet(SESSIONS_URL, authHeaders(userId)));
    const sessions: { id: string }[] = await getRes.json();
    const ids = sessions.map((s) => s.id);
    expect(ids).not.toContain(sessionId);
  });

  it("response includes sessionUrl pointing to the session", async () => {
    const res = await POST(makePost(URL, authHeaders(userId), {}));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.sessionUrl).toMatch(/^\/sessions\//);
    expect(data.sessionUrl).toContain(data.sessionId);
  });
});
