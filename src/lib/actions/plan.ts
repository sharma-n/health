"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  planIdSchema,
  planSchema,
  setPlanStatusSchema,
  updatePlanSchema,
  type PlanScheduleItemInput,
} from "@/lib/validation/plan";

export type PlanFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

const NOT_FOUND: PlanFormState = { error: "Plan not found." };

async function planRateLimited(userId: string): Promise<boolean> {
  const ip = await getClientIp();
  const key = ip ? `plan:${ip}` : `plan:user:${userId}`;
  return !checkRateLimit(key, 30, 5 * 60 * 1000);
}

function parseSchedule(formData: FormData): unknown {
  try {
    return JSON.parse((formData.get("schedule") as string) ?? "[]");
  } catch {
    return [];
  }
}

export async function createPlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await planRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const schedule = parseSchedule(formData);
  const parsed = planSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: "DRAFT",
    schedule,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const plan = await prisma.plan.create({
    data: {
      ownerId: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      status: "DRAFT",
      schedule: {
        createMany: {
          data: (parsed.data.schedule as PlanScheduleItemInput[]).map(
            (item) => ({
              dayOfWeek: item.dayOfWeek,
              workoutId: item.workoutId,
            }),
          ),
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/plans");
  redirect(`/plans/${plan.id}`);
}

export async function updatePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await planRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const schedule = parseSchedule(formData);
  const parsed = updatePlanSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status"),
    schedule,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { planId, ...fields } = parsed.data;

  const existing = await prisma.plan.findUnique({
    where: { id: planId },
    select: { ownerId: true },
  });

  if (!existing || existing.ownerId !== userId) return NOT_FOUND;

  await prisma.plan.update({
    where: { id: planId, ownerId: userId },
    data: {
      name: fields.name,
      description: fields.description,
      startDate: fields.startDate,
      endDate: fields.endDate,
      status: fields.status,
      schedule: {
        deleteMany: {},
        createMany: {
          data: (fields.schedule as PlanScheduleItemInput[]).map((item) => ({
            dayOfWeek: item.dayOfWeek,
            workoutId: item.workoutId,
          })),
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  redirect(`/plans/${planId}`);
}

export async function setPlanStatusAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await planRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = setPlanStatusSchema.safeParse({
    planId: formData.get("planId"),
    status: formData.get("status"),
  });

  if (!parsed.success) return NOT_FOUND;

  const { planId, status } = parsed.data;

  const existing = await prisma.plan.findUnique({
    where: { id: planId },
    select: { ownerId: true },
  });

  if (!existing || existing.ownerId !== userId) return NOT_FOUND;

  await prisma.plan.update({
    where: { id: planId, ownerId: userId },
    data: { status },
    select: { id: true },
  });

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  return { success: "Status updated." };
}

export async function deletePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await planRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = planIdSchema.safeParse({
    planId: formData.get("planId"),
  });
  if (!parsed.success) return NOT_FOUND;

  const { planId } = parsed.data;

  const existing = await prisma.plan.findUnique({
    where: { id: planId },
    select: { ownerId: true },
  });

  if (!existing || existing.ownerId !== userId) return NOT_FOUND;

  await prisma.plan.delete({
    where: { id: planId, ownerId: userId },
  });

  revalidatePath("/plans");
  redirect("/plans");
}
