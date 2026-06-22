"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { bodyMetricSchema } from "@/lib/validation/body-metric";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export type BodyMetricFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function logBodyMetricAction(
  _prevState: BodyMetricFormState,
  formData: FormData,
): Promise<BodyMetricFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "Not authenticated." };
  }

  // Rate limit
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`metrics:${ip}`, 30, 5 * 60 * 1000)) {
    return { error: "Too many requests. Please try again in a few moments." };
  }

  const parsed = bodyMetricSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    value: formData.get("value"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { date, type, value, note } = parsed.data;

  try {
    await prisma.bodyMetric.create({
      data: {
        userId,
        date,
        type,
        value,
        note,
      },
      select: { id: true },
    });
  } catch (error) {
    console.error("Body metric creation error:", error);
    return { error: "Failed to log measurement. Please try again." };
  }

  revalidatePath("/metrics");
  return {};
}

export async function deleteBodyMetricAction(
  _prevState: BodyMetricFormState,
  formData: FormData,
): Promise<BodyMetricFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "Not authenticated." };
  }

  const metricId = formData.get("metricId");
  if (!metricId || typeof metricId !== "string") {
    return { error: "Invalid metric ID." };
  }

  // Rate limit
  const ip = await getClientIp();
  if (ip && !checkRateLimit(`metrics:${ip}`, 30, 5 * 60 * 1000)) {
    return { error: "Too many requests. Please try again in a few moments." };
  }

  try {
    // Ensure metric belongs to the user
    const deleted = await prisma.bodyMetric.deleteMany({
      where: {
        id: metricId,
        userId,
      },
    });

    if (deleted.count === 0) {
      return { error: "Metric not found." };
    }
  } catch (error) {
    console.error("Body metric deletion error:", error);
    return { error: "Failed to delete measurement. Please try again." };
  }

  revalidatePath("/metrics");
  return {};
}
