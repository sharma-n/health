import { createTestDb, seedTestUser } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { completeOnboardingAction } from "@/lib/actions/onboarding";

beforeAll(async () => {
  (globalThis as any).__testDb = createTestDb();
});

afterAll(async () => {
  await (globalThis as any).__testDb.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function setup(onboardingComplete = false) {
  const db = (globalThis as any).__testDb;
  const { id: userId } = await seedTestUser(db, {
    email: `onboard-${Date.now()}@test.com`,
    onboardingComplete,
  });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
  return { db, userId };
}

describe("completeOnboardingAction", () => {
  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await completeOnboardingAction({}, new FormData());
    expect(result.error).toBe("Not authenticated.");
  });

  it("marks user as onboarded and redirects to /dashboard", async () => {
    const { db, userId } = await setup();
    const fd = new FormData();
    fd.set("bodyweightKg", "78");
    await completeOnboardingAction({}, fd);

    expect(redirect).toHaveBeenCalledWith("/dashboard");
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.onboardingComplete).toBe(true);
  });

  it("logs an initial bodyweight metric", async () => {
    const { db, userId } = await setup();
    const fd = new FormData();
    fd.set("bodyweightKg", "80.5");
    await completeOnboardingAction({}, fd);

    const metric = await db.bodyMetric.findFirst({ where: { userId, type: "BODYWEIGHT" } });
    expect(metric).not.toBeNull();
    expect(metric?.value).toBe(80.5);
  });

  it("creates a goal when goal JSON is provided", async () => {
    const { db, userId } = await setup();
    const fd = new FormData();
    fd.set("bodyweightKg", "");
    fd.set("goal", JSON.stringify({
      type: "CONSISTENCY",
      title: "Train weekly",
      config: { workoutsPerWeek: 3 },
    }));
    await completeOnboardingAction({}, fd);

    const goal = await db.goal.findFirst({ where: { userId } });
    expect(goal).not.toBeNull();
    expect(goal?.type).toBe("CONSISTENCY");
  });

  it("completes without bodyweight or goal", async () => {
    const { db, userId } = await setup();
    const result = await completeOnboardingAction({}, new FormData());
    // redirect throws (mocked as vi.fn) so no error returned
    expect(redirect).toHaveBeenCalledWith("/dashboard");
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.onboardingComplete).toBe(true);
  });
});
