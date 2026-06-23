import { createTestDb, seedTestUser } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logBodyMetricAction, deleteBodyMetricAction } from "@/lib/actions/body-metric";

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
  const { id: userId } = await seedTestUser(db, { email: `bm-${Date.now()}@test.com` });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
  return { db, userId };
}

describe("logBodyMetricAction", () => {
  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await logBodyMetricAction({}, new FormData());
    expect(result.error).toBe("Not authenticated.");
  });

  it("logs a bodyweight entry and redirects", async () => {
    const { db, userId } = await setup();
    const fd = new FormData();
    fd.set("date", "2026-07-01");
    fd.set("type", "BODYWEIGHT");
    fd.set("value", "82.5");
    await logBodyMetricAction({}, fd);

    expect(redirect).toHaveBeenCalledWith("/metrics");
    const metric = await db.bodyMetric.findFirst({ where: { userId, type: "BODYWEIGHT" } });
    expect(metric).not.toBeNull();
    expect(metric?.value).toBe(82.5);
  });

  it("returns fieldErrors for invalid type", async () => {
    await setup();
    const fd = new FormData();
    fd.set("date", "2026-07-01");
    fd.set("type", "WINGSPAN");
    fd.set("value", "10");
    const result = await logBodyMetricAction({}, fd);
    expect(result.fieldErrors?.type).toBeDefined();
  });

  it("returns fieldErrors for zero value", async () => {
    await setup();
    const fd = new FormData();
    fd.set("date", "2026-07-01");
    fd.set("type", "BODYWEIGHT");
    fd.set("value", "0");
    const result = await logBodyMetricAction({}, fd);
    expect(result.fieldErrors?.value).toBeDefined();
  });
});

describe("deleteBodyMetricAction", () => {
  it("deletes a user's metric", async () => {
    const { db, userId } = await setup();
    const { id: metricId } = await db.bodyMetric.create({
      data: { userId, date: new Date("2026-07-01"), type: "BODYWEIGHT", value: 80 },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("metricId", metricId);
    const result = await deleteBodyMetricAction({}, fd);
    expect(result.error).toBeUndefined();

    const metric = await db.bodyMetric.findUnique({ where: { id: metricId } });
    expect(metric).toBeNull();
  });

  it("returns not found for another user's metric", async () => {
    const { db } = await setup();
    const { id: otherId } = await seedTestUser(db, { email: `bmoth-${Date.now()}@test.com` });
    const { id: metricId } = await db.bodyMetric.create({
      data: { userId: otherId, date: new Date(), type: "BODYWEIGHT", value: 75 },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("metricId", metricId);
    const result = await deleteBodyMetricAction({}, fd);
    expect(result.error).toBe("Metric not found.");
  });
});
