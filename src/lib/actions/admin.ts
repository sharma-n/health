"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  adminChangePasswordSchema,
  adminDeleteUserSchema,
  adminResetDataSchema,
  adminSetRoleSchema,
} from "@/lib/validation/admin";

// Reuse the auth form-state shape so admin forms wire into the same
// useActionState + Field UI as login/register.
export type AdminFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

const BCRYPT_COST = 12;

type CallingAdmin = { id: string; passwordHash: string };

/**
 * Authorisation gate for every admin action. Reads `isAdmin` from the DB — never
 * trusts the JWT alone, which can be stale for up to 30 days after a demotion.
 * Returns the calling admin (with passwordHash, for re-auth) or null.
 */
async function requireAdmin(): Promise<CallingAdmin | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isAdmin: true, passwordHash: true },
  });
  if (!user || !user.isAdmin) return null;

  return { id: user.id, passwordHash: user.passwordHash };
}

// Generic boundary error — never reveals whether a target user exists or whether
// the caller simply lacks privilege (CLAUDE.md security rule #6).
const FORBIDDEN: AdminFormState = {
  error: "You don't have permission to do that.",
};

/** Shared rate-limit gate for admin actions: 30 actions per IP per 5 min. */
async function adminRateLimited(): Promise<boolean> {
  const ip = await getClientIp();
  return !!ip && !checkRateLimit(`admin:${ip}`, 30, 5 * 60 * 1000);
}

/**
 * Returns the ordered list of scoped deleteMany operations that wipe every
 * domain row belonging to `userId`. Compose into a single `prisma.$transaction`
 * so the wipe is atomic. Used by both "reset data" and "delete user".
 *
 * Order matters: rows that *reference* an exercise (SessionExercise,
 * WorkoutExercise) are deleted before the owned exercises themselves, so the
 * `onDelete: Restrict` on those relations never trips. Session/Plan/Workout
 * children precede their parents. Owned exercises are scoped to `ownerId` so
 * shared system exercises (`ownerId: null`) are never touched.
 */
function userDataDeletions(userId: string) {
  return [
    prisma.sessionSet.deleteMany({
      where: { sessionExercise: { session: { userId } } },
    }),
    prisma.sessionExercise.deleteMany({ where: { session: { userId } } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.workoutExercise.deleteMany({
      where: { workout: { ownerId: userId } },
    }),
    prisma.planScheduleItem.deleteMany({
      where: { plan: { ownerId: userId } },
    }),
    prisma.plan.deleteMany({ where: { ownerId: userId } }),
    prisma.workout.deleteMany({ where: { ownerId: userId } }),
    prisma.bodyMetric.deleteMany({ where: { userId } }),
    prisma.goal.deleteMany({ where: { userId } }),
    prisma.exercise.deleteMany({ where: { ownerId: userId } }),
  ];
}

export async function changeUserPasswordAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (await adminRateLimited()) {
    return { error: "Too many requests. Please try again later." };
  }
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = adminChangePasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { userId, newPassword, adminPassword } = parsed.data;
  if (!(await bcrypt.compare(adminPassword, admin.passwordHash))) {
    return { fieldErrors: { adminPassword: ["Password incorrect."] } };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: { passwordHash },
  });
  if (result.count === 0) return FORBIDDEN;

  revalidatePath("/admin");
  return { success: "Password updated." };
}

export async function deleteUserAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (await adminRateLimited()) {
    return { error: "Too many requests. Please try again later." };
  }
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = adminDeleteUserSchema.safeParse({
    userId: formData.get("userId"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { userId, adminPassword } = parsed.data;
  if (userId === admin.id) {
    return { error: "You can't delete your own account." };
  }
  if (!(await bcrypt.compare(adminPassword, admin.passwordHash))) {
    return { fieldErrors: { adminPassword: ["Password incorrect."] } };
  }

  // Confirm the target exists so the response is honest (a bare cascade delete
  // can't distinguish "not found" cleanly once we wrap it in a transaction).
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) return FORBIDDEN;

  // Wipe domain rows in FK-safe order, then remove the account — all atomic.
  // Deleting the user alone would cascade to owned exercises while sessions /
  // workouts still reference them, tripping `onDelete: Restrict`; the ordered
  // deletes clear those references first.
  await prisma.$transaction([
    ...userDataDeletions(userId),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);

  revalidatePath("/admin");
  return { success: "User deleted." };
}

export async function resetUserDataAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (await adminRateLimited()) {
    return { error: "Too many requests. Please try again later." };
  }
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = adminResetDataSchema.safeParse({
    userId: formData.get("userId"),
    adminPassword: formData.get("adminPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { userId, adminPassword } = parsed.data;
  if (!(await bcrypt.compare(adminPassword, admin.passwordHash))) {
    return { fieldErrors: { adminPassword: ["Password incorrect."] } };
  }

  // Confirm the target actually exists so the response is honest.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) return FORBIDDEN;

  // Atomically wipe all of the user's domain rows (the user account itself is
  // kept). Ordered so the exercise `Restrict` relations never trip — see
  // userDataDeletions.
  await prisma.$transaction(userDataDeletions(userId));

  revalidatePath("/admin");
  return { success: "User data reset." };
}

export async function setUserRoleAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  if (await adminRateLimited()) {
    return { error: "Too many requests. Please try again later." };
  }
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = adminSetRoleSchema.safeParse({
    userId: formData.get("userId"),
    makeAdmin: formData.get("makeAdmin"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { userId, makeAdmin } = parsed.data;

  // Revoking admin: never drop the count of admins to zero (would lock everyone
  // out of the admin area). Covers both demote-self and demote-other.
  if (!makeAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return { error: "You can't remove the last admin." };
    }
  }

  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: { isAdmin: makeAdmin },
  });
  if (result.count === 0) return FORBIDDEN;

  revalidatePath("/admin");
  return {
    success: makeAdmin
      ? "Admin granted. The user must sign out and back in for it to take effect."
      : "Admin revoked. Takes effect after the user's next sign-in.",
  };
}
