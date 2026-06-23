import { createTestDb, seedTestUser } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  createPlanAction,
  updatePlanAction,
  setPlanStatusAction,
  deletePlanAction,
} from "@/lib/actions/plan";

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
  const { id: userId } = await seedTestUser(db, { email: `plan-${Date.now()}@test.com` });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
  return { db, userId };
}

describe("createPlanAction", () => {
  it("returns Unauthorized when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await createPlanAction({}, new FormData());
    expect(result.error).toBe("Unauthorized.");
  });

  it("returns fieldErrors when name is missing", async () => {
    await setup();
    const result = await createPlanAction({}, new FormData());
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("creates a plan with schedule and redirects", async () => {
    const { db, userId } = await setup();
    const { id: workoutId } = await db.workout.create({
      data: { ownerId: userId, name: "Mon Workout" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("name", "My 4-Week Plan");
    fd.set("startDate", "2026-07-01");
    fd.set("endDate", "2026-07-28");
    fd.set("schedule", JSON.stringify([{ dayOfWeek: 1, workoutId }]));
    await createPlanAction({}, fd);

    expect(redirect).toHaveBeenCalledWith(expect.stringMatching(/^\/plans\//));

    const plan = await db.plan.findFirst({ where: { ownerId: userId, name: "My 4-Week Plan" } });
    expect(plan).not.toBeNull();
    expect(plan?.status).toBe("DRAFT");

    const schedule = await db.planScheduleItem.findMany({ where: { planId: plan!.id } });
    expect(schedule).toHaveLength(1);
    expect(schedule[0].dayOfWeek).toBe(1);
  });
});

describe("updatePlanAction", () => {
  it("updates plan name", async () => {
    const { db, userId } = await setup();
    const { id: planId } = await db.plan.create({
      data: { ownerId: userId, name: "Old Plan", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-28"), status: "DRAFT" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("name", "New Plan");
    fd.set("startDate", "2026-07-01");
    fd.set("endDate", "2026-07-28");
    fd.set("status", "DRAFT");
    fd.set("schedule", JSON.stringify([]));
    await updatePlanAction({}, fd);

    const plan = await db.plan.findUnique({ where: { id: planId } });
    expect(plan?.name).toBe("New Plan");
  });

  it("returns not found for another user's plan", async () => {
    const { db } = await setup();
    const { id: otherId } = await seedTestUser(db, { email: `ploth-${Date.now()}@test.com` });
    const { id: planId } = await db.plan.create({
      data: { ownerId: otherId, name: "Other Plan", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-28"), status: "DRAFT" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("name", "Stolen");
    fd.set("startDate", "2026-07-01");
    fd.set("endDate", "2026-07-28");
    fd.set("status", "DRAFT");
    fd.set("schedule", JSON.stringify([]));
    const result = await updatePlanAction({}, fd);
    expect(result.error).toBe("Plan not found.");
  });
});

describe("setPlanStatusAction", () => {
  it("activates a draft plan", async () => {
    const { db, userId } = await setup();
    const { id: planId } = await db.plan.create({
      data: { ownerId: userId, name: "P", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-28"), status: "DRAFT" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("status", "ACTIVE");
    const result = await setPlanStatusAction({}, fd);
    expect(result.success).toBe("Status updated.");

    const plan = await db.plan.findUnique({ where: { id: planId } });
    expect(plan?.status).toBe("ACTIVE");
  });

  it("returns not found for another user's plan", async () => {
    const { db } = await setup();
    const { id: otherId } = await seedTestUser(db, { email: `plstat-${Date.now()}@test.com` });
    const { id: planId } = await db.plan.create({
      data: { ownerId: otherId, name: "X", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-28"), status: "DRAFT" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("status", "ACTIVE");
    const result = await setPlanStatusAction({}, fd);
    expect(result.error).toBe("Plan not found.");
  });
});

describe("deletePlanAction", () => {
  it("deletes a plan and redirects", async () => {
    const { db, userId } = await setup();
    const { id: planId } = await db.plan.create({
      data: { ownerId: userId, name: "Del Plan", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-28"), status: "DRAFT" },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("planId", planId);
    await deletePlanAction({}, fd);
    expect(redirect).toHaveBeenCalledWith("/plans");

    const plan = await db.plan.findUnique({ where: { id: planId } });
    expect(plan).toBeNull();
  });
});
