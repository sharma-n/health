import { createTestDb, seedTestUser, seedTestExercise } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  createGoalAction,
  updateGoalAction,
  setGoalStatusAction,
  deleteGoalAction,
} from "@/lib/actions/goal";

beforeAll(async () => {
  (globalThis as any).__testDb = createTestDb();
});

afterAll(async () => {
  await (globalThis as any).__testDb.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function setup() {
  const db = (globalThis as any).__testDb;
  const { id: userId } = await seedTestUser(db, { email: `goal-${Date.now()}@test.com` });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
  return { db, userId };
}

describe("createGoalAction", () => {
  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await createGoalAction({}, new FormData());
    expect(result.error).toBe("Not authenticated.");
  });

  it("creates a CONSISTENCY goal and redirects", async () => {
    const { db, userId } = await setup();
    const fd = new FormData();
    fd.set("type", "CONSISTENCY");
    fd.set("title", "Train 3x/week");
    fd.set("config", JSON.stringify({ workoutsPerWeek: 3 }));
    await createGoalAction({}, fd);

    expect(redirect).toHaveBeenCalledWith("/goals");
    const goal = await db.goal.findFirst({ where: { userId, title: "Train 3x/week" } });
    expect(goal).not.toBeNull();
    expect(goal?.type).toBe("CONSISTENCY");
    expect(goal?.status).toBe("ACTIVE");
  });

  it("creates a STRENGTH goal", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `GoalEx-${Date.now()}`);
    const fd = new FormData();
    fd.set("type", "STRENGTH");
    fd.set("title", "Bench 100kg");
    fd.set("config", JSON.stringify({ exerciseId: exId, metric: "1RM", targetValueKg: 100 }));
    await createGoalAction({}, fd);

    const goal = await db.goal.findFirst({ where: { userId, title: "Bench 100kg" } });
    expect(goal?.type).toBe("STRENGTH");
  });

  it("returns fieldErrors when config is invalid", async () => {
    await setup();
    const fd = new FormData();
    fd.set("type", "CONSISTENCY");
    fd.set("title", "Bad");
    fd.set("config", JSON.stringify({ workoutsPerWeek: -1 })); // invalid
    const result = await createGoalAction({}, fd);
    expect(result.fieldErrors).toBeDefined();
  });
});

describe("setGoalStatusAction", () => {
  it("changes status to ACHIEVED", async () => {
    const { db, userId } = await setup();
    const { id: goalId } = await db.goal.create({
      data: { userId, type: "CONSISTENCY", title: "G", status: "ACTIVE", config: { workoutsPerWeek: 3 } },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("status", "ACHIEVED");
    // Action redirects on success; check DB state directly
    await setGoalStatusAction({}, fd);

    const goal = await db.goal.findUnique({ where: { id: goalId } });
    expect(goal?.status).toBe("ACHIEVED");
  });

  it("returns not found for another user's goal", async () => {
    const { db } = await setup();
    const { id: otherId } = await seedTestUser(db, { email: `goth-${Date.now()}@test.com` });
    const { id: goalId } = await db.goal.create({
      data: { userId: otherId, type: "CONSISTENCY", title: "Other", status: "ACTIVE", config: { workoutsPerWeek: 1 } },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("goalId", goalId);
    fd.set("status", "ACHIEVED");
    const result = await setGoalStatusAction({}, fd);
    expect(result.error).toBe("Goal not found.");
  });
});

describe("deleteGoalAction", () => {
  it("deletes a goal and redirects", async () => {
    const { db, userId } = await setup();
    const { id: goalId } = await db.goal.create({
      data: { userId, type: "CONSISTENCY", title: "Del", status: "ACTIVE", config: { workoutsPerWeek: 1 } },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("goalId", goalId);
    await deleteGoalAction({}, fd);
    expect(redirect).toHaveBeenCalledWith("/goals");

    const goal = await db.goal.findUnique({ where: { id: goalId } });
    expect(goal).toBeNull();
  });
});
