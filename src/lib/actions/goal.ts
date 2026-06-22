"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { goalSchema, setGoalStatusSchema } from "@/lib/validation/goal";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type GoalFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createGoalAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "Not authenticated." };
  }

  // Rate limit
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`goals:${ip}`, 30, 5 * 60 * 1000)) {
    return { error: "Too many requests. Please try again in a few moments." };
  }

  // Parse goal config from JSON if present
  const config = formData.get("config") ? JSON.parse(formData.get("config") as string) : undefined;

  const parsed = goalSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    targetDate: formData.get("targetDate") === "" ? null : formData.get("targetDate"),
    status: formData.get("status") || "ACTIVE",
    config,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { type, title, targetDate, status, config: goalConfig } = parsed.data;

  try {
    await prisma.goal.create({
      data: {
        userId,
        type,
        title,
        targetDate,
        status,
        config: goalConfig,
      },
      select: { id: true },
    });
  } catch (error) {
    console.error("Goal creation error:", error);
    return { error: "Failed to create goal. Please try again." };
  }

  redirect("/goals");
}

export async function updateGoalAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "Not authenticated." };
  }

  const goalId = formData.get("goalId");
  if (!goalId || typeof goalId !== "string") {
    return { error: "Invalid goal ID." };
  }

  // Rate limit
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`goals:${ip}`, 30, 5 * 60 * 1000)) {
    return { error: "Too many requests. Please try again in a few moments." };
  }

  // Parse goal config from JSON if present
  const config = formData.get("config") ? JSON.parse(formData.get("config") as string) : undefined;

  const parsed = goalSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    targetDate: formData.get("targetDate") === "" ? null : formData.get("targetDate"),
    status: formData.get("status") || "ACTIVE",
    config,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { type, title, targetDate, status, config: goalConfig } = parsed.data;

  try {
    // Ensure goal belongs to the user
    const updated = await prisma.goal.updateMany({
      where: {
        id: goalId,
        userId,
      },
      data: {
        type,
        title,
        targetDate,
        status,
        config: goalConfig,
      },
    });

    if (updated.count === 0) {
      return { error: "Goal not found." };
    }
  } catch (error) {
    console.error("Goal update error:", error);
    return { error: "Failed to update goal. Please try again." };
  }

  redirect("/goals");
}

export async function setGoalStatusAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "Not authenticated." };
  }

  // Rate limit
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`goals:${ip}`, 30, 5 * 60 * 1000)) {
    return { error: "Too many requests. Please try again in a few moments." };
  }

  const parsed = setGoalStatusSchema.safeParse({
    goalId: formData.get("goalId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { goalId, status } = parsed.data;

  try {
    // Ensure goal belongs to the user
    const updated = await prisma.goal.updateMany({
      where: {
        id: goalId,
        userId,
      },
      data: { status },
    });

    if (updated.count === 0) {
      return { error: "Goal not found." };
    }
  } catch (error) {
    console.error("Goal status update error:", error);
    return { error: "Failed to update goal status. Please try again." };
  }

  return {};
}

export async function deleteGoalAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "Not authenticated." };
  }

  const goalId = formData.get("goalId");
  if (!goalId || typeof goalId !== "string") {
    return { error: "Invalid goal ID." };
  }

  // Rate limit
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`goals:${ip}`, 30, 5 * 60 * 1000)) {
    return { error: "Too many requests. Please try again in a few moments." };
  }

  try {
    // Ensure goal belongs to the user
    const deleted = await prisma.goal.deleteMany({
      where: {
        id: goalId,
        userId,
      },
    });

    if (deleted.count === 0) {
      return { error: "Goal not found." };
    }
  } catch (error) {
    console.error("Goal deletion error:", error);
    return { error: "Failed to delete goal. Please try again." };
  }

  redirect("/goals");
}
