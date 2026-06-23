import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/internal/goals/[id]/route";
import { createTestDb, seedTestUser } from "@/__tests__/helpers/db";
import type { PrismaClient } from "@/generated/prisma/client";

const SECRET = "test-internal-secret-goal-update";

function makePatch(id: string, headers: Record<string, string>, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/internal/goals/${id}`, {
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

describe("PATCH /api/internal/goals/[id]", () => {
  let db: PrismaClient;
  let userId: string;
  let goalId: string;

  beforeAll(async () => {
    process.env.INTERNAL_API_SECRET = SECRET;
    db = createTestDb();
    (globalThis as any).__testDb = db;
    const user = await seedTestUser(db);
    userId = user.id;

    const goal = await db.goal.create({
      data: {
        userId,
        type: "CONSISTENCY",
        title: "Train 3x/week",
        status: "ACTIVE",
        config: { workoutsPerWeek: 3 },
      },
      select: { id: true },
    });
    goalId = goal.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects missing secret", async () => {
    const res = await PATCH(
      makePatch(goalId, { "x-user-id": userId }, { title: "New" }),
      { params: makeParams(goalId) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for a goal belonging to a different user", async () => {
    const res = await PATCH(
      makePatch(goalId, authHeaders("other-user-id"), { title: "Stolen" }),
      { params: makeParams(goalId) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid status value", async () => {
    const res = await PATCH(
      makePatch(goalId, authHeaders(userId), { status: "COMPLETED" }),
      { params: makeParams(goalId) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when no fields are provided", async () => {
    const res = await PATCH(
      makePatch(goalId, authHeaders(userId), {}),
      { params: makeParams(goalId) },
    );
    expect(res.status).toBe(400);
  });

  it("updates title only — config and status preserved", async () => {
    const res = await PATCH(
      makePatch(goalId, authHeaders(userId), { title: "Train 4x/week" }),
      { params: makeParams(goalId) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(goalId);

    const goal = await db.goal.findUnique({ where: { id: goalId } });
    expect(goal!.title).toBe("Train 4x/week");
    expect(goal!.status).toBe("ACTIVE");
    expect((goal!.config as any).workoutsPerWeek).toBe(3);
  });

  it("updates status only", async () => {
    const res = await PATCH(
      makePatch(goalId, authHeaders(userId), { status: "ACHIEVED" }),
      { params: makeParams(goalId) },
    );
    expect(res.status).toBe(200);

    const goal = await db.goal.findUnique({ where: { id: goalId } });
    expect(goal!.status).toBe("ACHIEVED");
    expect(goal!.title).toBe("Train 4x/week"); // still the updated title from previous test
  });

  it("shallow-merges config_patch — existing keys preserved", async () => {
    // First create a STRENGTH goal with existing config
    const strengthGoal = await db.goal.create({
      data: {
        userId,
        type: "STRENGTH",
        title: "Bench 100 kg",
        status: "ACTIVE",
        config: { exerciseId: "ex1", metric: "1RM", targetValueKg: 100, startingValueKg: 70 },
      },
      select: { id: true },
    });

    const res = await PATCH(
      makePatch(strengthGoal.id, authHeaders(userId), { config: { targetValueKg: 110 } }),
      { params: makeParams(strengthGoal.id) },
    );
    expect(res.status).toBe(200);

    const goal = await db.goal.findUnique({ where: { id: strengthGoal.id } });
    const config = goal!.config as any;
    expect(config.targetValueKg).toBe(110);          // updated
    expect(config.startingValueKg).toBe(70);          // preserved
    expect(config.exerciseId).toBe("ex1");            // preserved
  });
});
