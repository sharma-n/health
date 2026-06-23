import { createTestDb, seedTestUser } from "../../helpers/db";
import { auth } from "@/auth";
import {
  changeUserPasswordAction,
  deleteUserAction,
  resetUserDataAction,
  setUserRoleAction,
} from "@/lib/actions/admin";

const ADMIN_PASSWORD = "TestPass123!"; // matches seedTestUser's hash (cost 1)

beforeAll(async () => {
  (globalThis as any).__testDb = createTestDb();
});

afterAll(async () => {
  await (globalThis as any).__testDb.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function setupAdmin() {
  const db = (globalThis as any).__testDb;
  const { id: adminId } = await seedTestUser(db, {
    email: `admin-${Date.now()}@test.com`,
    isAdmin: true,
  });
  vi.mocked(auth).mockResolvedValue({ user: { id: adminId, isAdmin: true } } as any);
  return { db, adminId };
}

async function setupTarget(db: any) {
  const { id: targetId } = await seedTestUser(db, { email: `target-${Date.now()}@test.com` });
  return targetId;
}

// ── Auth gates ────────────────────────────────────────────────────────────────

describe("admin actions — auth gates", () => {
  it("returns FORBIDDEN when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await changeUserPasswordAction({}, new FormData());
    expect(result.error).toContain("permission");
  });

  it("returns FORBIDDEN when caller is not admin", async () => {
    const db = (globalThis as any).__testDb;
    const { id: userId } = await seedTestUser(db, { email: `nonadmin-${Date.now()}@test.com` });
    vi.mocked(auth).mockResolvedValue({ user: { id: userId, isAdmin: false } } as any);
    const result = await changeUserPasswordAction({}, new FormData());
    expect(result.error).toContain("permission");
  });
});

// ── changeUserPasswordAction ──────────────────────────────────────────────────

describe("changeUserPasswordAction", () => {
  it("returns incorrect password error for wrong adminPassword", async () => {
    const { db } = await setupAdmin();
    const targetId = await setupTarget(db);

    const fd = new FormData();
    fd.set("userId", targetId);
    fd.set("newPassword", "NewPassword1!");
    fd.set("adminPassword", "WrongPassword");
    const result = await changeUserPasswordAction({}, fd);
    expect(result.fieldErrors?.adminPassword).toBeDefined();
  });

  it("changes the target user's password", async () => {
    const { db } = await setupAdmin();
    const targetId = await setupTarget(db);

    const fd = new FormData();
    fd.set("userId", targetId);
    fd.set("newPassword", "NewPassword1!");
    fd.set("adminPassword", ADMIN_PASSWORD);
    const result = await changeUserPasswordAction({}, fd);
    expect(result.success).toBe("Password updated.");
  });
});

// ── deleteUserAction ──────────────────────────────────────────────────────────

describe("deleteUserAction", () => {
  it("prevents admin from deleting their own account", async () => {
    const { adminId } = await setupAdmin();

    const fd = new FormData();
    fd.set("userId", adminId);
    fd.set("adminPassword", ADMIN_PASSWORD);
    const result = await deleteUserAction({}, fd);
    expect(result.error).toContain("own account");
  });

  it("deletes a target user", async () => {
    const { db } = await setupAdmin();
    const targetId = await setupTarget(db);

    const fd = new FormData();
    fd.set("userId", targetId);
    fd.set("adminPassword", ADMIN_PASSWORD);
    const result = await deleteUserAction({}, fd);
    expect(result.success).toBeDefined();

    const user = await db.user.findUnique({ where: { id: targetId } });
    expect(user).toBeNull();
  });
});

// ── resetUserDataAction ───────────────────────────────────────────────────────

describe("resetUserDataAction", () => {
  it("wipes user data but preserves the account", async () => {
    const { db } = await setupAdmin();
    const targetId = await setupTarget(db);

    // Give the target user some data
    await db.goal.create({
      data: { userId: targetId, type: "CONSISTENCY", title: "G", status: "ACTIVE", config: { workoutsPerWeek: 1 } },
    });
    await db.bodyMetric.create({ data: { userId: targetId, date: new Date(), type: "BODYWEIGHT", value: 80 } });

    const fd = new FormData();
    fd.set("userId", targetId);
    fd.set("adminPassword", ADMIN_PASSWORD);
    const result = await resetUserDataAction({}, fd);
    expect(result.success).toBeDefined();

    // Account still exists
    const user = await db.user.findUnique({ where: { id: targetId } });
    expect(user).not.toBeNull();
    // But data is gone
    const goals = await db.goal.findMany({ where: { userId: targetId } });
    expect(goals).toHaveLength(0);
    const metrics = await db.bodyMetric.findMany({ where: { userId: targetId } });
    expect(metrics).toHaveLength(0);
  });
});

// ── setUserRoleAction ─────────────────────────────────────────────────────────

describe("setUserRoleAction", () => {
  it("grants admin to a non-admin user", async () => {
    const { db } = await setupAdmin();
    const targetId = await setupTarget(db);

    const fd = new FormData();
    fd.set("userId", targetId);
    fd.set("makeAdmin", "true");
    const result = await setUserRoleAction({}, fd);
    expect(result.success).toBeDefined();

    const user = await db.user.findUnique({ where: { id: targetId } });
    expect(user?.isAdmin).toBe(true);
  });

  it("prevents demoting the last remaining admin", async () => {
    const { adminId, db } = await setupAdmin();

    // Multiple tests call setupAdmin() → multiple admins accumulate.
    // Ensure only this one admin remains so the guard triggers.
    await db.user.updateMany({
      where: { isAdmin: true, NOT: { id: adminId } },
      data: { isAdmin: false },
    });

    const fd = new FormData();
    fd.set("userId", adminId);
    fd.set("makeAdmin", "false");
    const result = await setUserRoleAction({}, fd);
    expect(result.error).toContain("last admin");
  });
});
