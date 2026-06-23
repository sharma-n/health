"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { loginSchema, registerSchema, updateProfileSchema, updateTimezoneSchema } from "@/lib/validation/auth";
import { DEFAULT_UNIT_PREFERENCE } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type ProfileFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

const BCRYPT_COST = 12;

function registrationEnabled(): boolean {
  // Default to enabled unless explicitly turned off. See SPEC.md §8.
  return process.env.ALLOW_REGISTRATION !== "false";
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!registrationEnabled()) {
    return { error: "Registration is disabled on this server." };
  }

  // 5 registrations per IP per hour.
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, displayName, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    // The very first registered user becomes the admin. Run the count + create
    // in a transaction so two simultaneous first-registrations can't both win.
    await prisma.$transaction(async (tx) => {
      const isFirstUser = (await tx.user.count()) === 0;
      await tx.user.create({
        data: {
          email,
          displayName,
          passwordHash,
          unitPreference: DEFAULT_UNIT_PREFERENCE,
          isAdmin: isFirstUser,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Generic message — avoids confirming whether an email is registered.
      return { error: "Unable to create account. Please check your details or sign in if you already have an account." };
    }
    throw error;
  }

  // Auto sign-in; signIn redirects to /onboarding on success.
  await signIn("credentials", {
    email,
    password,
    redirectTo: "/onboarding",
  });

  return {};
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // 10 attempts per IP per 15 minutes.
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
    return { error: "Too many login attempts. Please try again later." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Re-throw redirect (and any non-auth) errors so navigation works.
    throw error;
  }

  return {};
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { auth: authFn } = await import("@/auth");
  const session = await authFn();
  const userId = session?.user?.id;

  if (!userId) {
    return { error: "Unauthorized." };
  }

  const ip = await getClientIp();
  if (ip && !checkRateLimit(`profile:${ip}`, 10, 60 * 1000)) {
    return { error: "Too many requests. Please try again later." };
  }

  const parsed = updateProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    unitPreference: formData.get("unitPreference"),
    timezone: formData.get("timezone") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: parsed.data.displayName,
        unitPreference: parsed.data.unitPreference,
        ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
      },
    });
  } catch {
    return { error: "Failed to update profile. Please try again." };
  }

  return { success: true };
}

/**
 * Silently update only the user's timezone. Called by the TimezoneDetector
 * component on first visit when the stored timezone is still the "UTC" default.
 */
export async function updateTimezoneAction(timezone: string): Promise<void> {
  const { auth: authFn } = await import("@/auth");
  const session = await authFn();
  const userId = session?.user?.id;
  if (!userId) return;

  const parsed = updateTimezoneSchema.safeParse({ timezone });
  if (!parsed.success) return;

  await prisma.user.update({
    where: { id: userId },
    data: { timezone: parsed.data.timezone },
  }).catch(() => {});
}
