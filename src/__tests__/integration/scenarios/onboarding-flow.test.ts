/**
 * Journey: fresh user → completeOnboardingAction → bodyweight logged + goal created
 */
import { createTestDb, seedTestUser } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { completeOnboardingAction } from "@/lib/actions/onboarding";

let db: any;

beforeAll(async () => {
  db = createTestDb();
  (globalThis as any).__testDb = db;
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

it("onboarding: logs weight, creates goal, marks complete, redirects", async () => {
  const { id: userId } = await seedTestUser(db, {
    email: `onbflow-${Date.now()}@test.com`,
    onboardingComplete: false,
  });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);

  const fd = new FormData();
  fd.set("bodyweightKg", "75");
  fd.set("goal", JSON.stringify({
    type: "CONSISTENCY",
    title: "Train 3 times a week",
    config: { workoutsPerWeek: 3 },
  }));

  await completeOnboardingAction({}, fd);

  expect(redirect).toHaveBeenCalledWith("/dashboard");

  const user = await db.user.findUnique({ where: { id: userId } });
  expect(user?.onboardingComplete).toBe(true);

  const metric = await db.bodyMetric.findFirst({ where: { userId, type: "BODYWEIGHT" } });
  expect(metric).not.toBeNull();
  expect(metric.value).toBe(75);

  const goal = await db.goal.findFirst({ where: { userId } });
  expect(goal).not.toBeNull();
  expect(goal.type).toBe("CONSISTENCY");
  expect(goal.title).toBe("Train 3 times a week");
});

it("onboarding: skips bodyweight and goal if empty", async () => {
  const { id: userId } = await seedTestUser(db, {
    email: `onbflow2-${Date.now()}@test.com`,
    onboardingComplete: false,
  });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);

  await completeOnboardingAction({}, new FormData());

  expect(redirect).toHaveBeenCalledWith("/dashboard");

  const user = await db.user.findUnique({ where: { id: userId } });
  expect(user?.onboardingComplete).toBe(true);

  const metrics = await db.bodyMetric.findMany({ where: { userId } });
  expect(metrics).toHaveLength(0);

  const goals = await db.goal.findMany({ where: { userId } });
  expect(goals).toHaveLength(0);
});
