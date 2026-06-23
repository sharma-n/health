/**
 * Journey: create STRENGTH goal → log sets → check computeGoalProgress reflects progress
 */
import { createTestDb, seedTestUser, seedTestExercise } from "../../helpers/db";
import { auth } from "@/auth";
import { createGoalAction, setGoalStatusAction } from "@/lib/actions/goal";
import { upsertSetAction } from "@/lib/actions/session";
import { computeGoalProgress } from "@/lib/analytics/goals";

let db: any;
let userId: string;

beforeAll(async () => {
  db = createTestDb();
  (globalThis as any).__testDb = db;
  ({ id: userId } = await seedTestUser(db, { email: `goalflow-${Date.now()}@test.com` }));
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
});

it("STRENGTH goal progress updates when sets are logged", async () => {
  const { id: exId } = await seedTestExercise(db, userId, `GFEx-${Date.now()}`);

  // Create goal: bench 120kg 1RM
  const fd = new FormData();
  fd.set("type", "STRENGTH");
  fd.set("title", "Bench 120kg");
  fd.set("config", JSON.stringify({ exerciseId: exId, metric: "1RM", targetValueKg: 120 }));
  await createGoalAction({}, fd);

  const goal = await db.goal.findFirst({ where: { userId, title: "Bench 120kg" } });
  expect(goal).not.toBeNull();

  // Log a session set: 100kg × 5 reps → Epley 1RM ≈ 116.7
  const { id: sessionId } = await db.session.create({ data: { userId, startedAt: new Date() }, select: { id: true } });
  const { id: seId } = await db.sessionExercise.create({ data: { sessionId, exerciseId: exId, order: 0 }, select: { id: true } });
  await upsertSetAction({ sessionExerciseId: seId, setNumber: 1, weightKg: 100, reps: 5, completed: true });

  // Check progress
  const progress = await computeGoalProgress(
    { userId, type: "STRENGTH", config: { exerciseId: exId, metric: "1RM", targetValueKg: 120 } },
    db,
  );
  expect(progress.current).toBeCloseTo(116.67, 0);
  expect(progress.percentage).toBeGreaterThan(90);
  expect(progress.percentage).toBeLessThan(100);
});

it("CONSISTENCY goal counts sessions per week", async () => {
  // Create goal: 3 sessions/week
  const fd = new FormData();
  fd.set("type", "CONSISTENCY");
  fd.set("title", "Train 3x/week");
  fd.set("config", JSON.stringify({ workoutsPerWeek: 3 }));
  await createGoalAction({}, fd);

  // Log 2 sessions this week
  await db.session.createMany({
    data: [
      { userId, startedAt: new Date(), endedAt: new Date() },
      { userId, startedAt: new Date(), endedAt: new Date() },
    ],
  });

  const progress = await computeGoalProgress(
    { userId, type: "CONSISTENCY", config: { workoutsPerWeek: 3 } },
    db,
  );
  // At least 2 sessions this week means ~66% (may be more if prior tests also created sessions)
  expect(progress.current).toBeGreaterThanOrEqual(2);
});

it("setGoalStatusAction marks goal as ACHIEVED", async () => {
  const { id: goalId } = await db.goal.create({
    data: { userId, type: "CONSISTENCY", title: "Done", status: "ACTIVE", config: { workoutsPerWeek: 1 } },
    select: { id: true },
  });

  const fd = new FormData();
  fd.set("goalId", goalId);
  fd.set("status", "ACHIEVED");
  // Action redirects on success (returns undefined from the vi.fn mock); check DB
  await setGoalStatusAction({}, fd);

  const goal = await db.goal.findUnique({ where: { id: goalId } });
  expect(goal?.status).toBe("ACHIEVED");
});

it("BODY_METRIC goal uses latest metric when multiple logged on same day", async () => {
  const sameDate = new Date("2026-06-24");

  // Create goal: lose weight from 80kg to 75kg
  const fd = new FormData();
  fd.set("type", "BODY_METRIC");
  fd.set("title", "Lose weight");
  fd.set("config", JSON.stringify({ metricType: "BODYWEIGHT", startingValue: 80, targetValue: 75 }));
  await createGoalAction({}, fd);

  const goal = await db.goal.findFirst({ where: { userId, title: "Lose weight" } });
  expect(goal).not.toBeNull();

  // Log two metrics on the same day: first 80.5kg, then 79.8kg
  // The goal should use the second one (latest createdAt)
  await db.bodyMetric.create({
    data: { userId, date: sameDate, type: "BODYWEIGHT", value: 80.5 },
  });

  // Add a small delay to ensure createdAt timestamps are different
  await new Promise((resolve) => setTimeout(resolve, 10));

  await db.bodyMetric.create({
    data: { userId, date: sameDate, type: "BODYWEIGHT", value: 79.8 },
  });

  // Check progress: should use 79.8 (latest), not 80.5
  // Progress: (79.8 - 80) / (75 - 80) * 100 = 4%
  const progress = await computeGoalProgress(
    { userId, type: "BODY_METRIC", config: { metricType: "BODYWEIGHT", startingValue: 80, targetValue: 75 } },
    db,
  );
  expect(progress.current).toBe(79.8);
  expect(progress.percentage).toBeCloseTo(4, 0);
});
