/**
 * Journey: admin creates target user → changes password → resets data → deletes user
 */
import { createTestDb, seedTestUser } from "../../helpers/db";
import { auth } from "@/auth";
import { changeUserPasswordAction, resetUserDataAction, deleteUserAction, setUserRoleAction } from "@/lib/actions/admin";

const ADMIN_PASSWORD = "TestPass123!";

let db: any;
let adminId: string;

beforeAll(async () => {
  db = createTestDb();
  (globalThis as any).__testDb = db;
  ({ id: adminId } = await seedTestUser(db, { email: `adminflow-${Date.now()}@test.com`, isAdmin: true }));
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: adminId, isAdmin: true } } as any);
});

it("admin lifecycle: create user, reset data, promote, delete", async () => {
  // Setup target user with some data
  const { id: targetId } = await seedTestUser(db, { email: `adminflow-target-${Date.now()}@test.com` });
  await db.goal.create({
    data: { userId: targetId, type: "CONSISTENCY", title: "G", status: "ACTIVE", config: { workoutsPerWeek: 1 } },
  });

  // Step 1: Change target's password
  const changeFd = new FormData();
  changeFd.set("userId", targetId);
  changeFd.set("newPassword", "NewTargetPass1!");
  changeFd.set("adminPassword", ADMIN_PASSWORD);
  const changeResult = await changeUserPasswordAction({}, changeFd);
  expect(changeResult.success).toBe("Password updated.");

  // Step 2: Grant admin role to target
  const roleFd = new FormData();
  roleFd.set("userId", targetId);
  roleFd.set("makeAdmin", "true");
  const roleResult = await setUserRoleAction({}, roleFd);
  expect(roleResult.success).toBeDefined();

  let user = await db.user.findUnique({ where: { id: targetId } });
  expect(user?.isAdmin).toBe(true);

  // Step 3: Revoke admin role (now there are 2 admins so it's safe)
  const revokeFd = new FormData();
  revokeFd.set("userId", targetId);
  revokeFd.set("makeAdmin", "false");
  const revokeResult = await setUserRoleAction({}, revokeFd);
  expect(revokeResult.success).toBeDefined();

  // Step 4: Reset user data (wipes rows, preserves account)
  const resetFd = new FormData();
  resetFd.set("userId", targetId);
  resetFd.set("adminPassword", ADMIN_PASSWORD);
  const resetResult = await resetUserDataAction({}, resetFd);
  expect(resetResult.success).toBeDefined();

  const goals = await db.goal.findMany({ where: { userId: targetId } });
  expect(goals).toHaveLength(0);
  user = await db.user.findUnique({ where: { id: targetId } });
  expect(user).not.toBeNull(); // account preserved

  // Step 5: Delete the user entirely
  const deleteFd = new FormData();
  deleteFd.set("userId", targetId);
  deleteFd.set("adminPassword", ADMIN_PASSWORD);
  const deleteResult = await deleteUserAction({}, deleteFd);
  expect(deleteResult.success).toBeDefined();

  user = await db.user.findUnique({ where: { id: targetId } });
  expect(user).toBeNull();
});

it("non-admin cannot call admin actions", async () => {
  const { id: regularId } = await seedTestUser(db, { email: `nonadmin-${Date.now()}@test.com` });
  vi.mocked(auth).mockResolvedValue({ user: { id: regularId, isAdmin: false } } as any);

  const result = await changeUserPasswordAction({}, new FormData());
  expect(result.error).toContain("permission");
});
