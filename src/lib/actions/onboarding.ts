"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validation/onboarding";

export type OnboardingFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function completeOnboardingAction(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "Not authenticated." };
  }

  // Parse form data; convert goal JSON if present
  const parsed = onboardingSchema.safeParse({
    bodyweightKg: formData.get("bodyweightKg") === "" ? null : formData.get("bodyweightKg"),
    goal: formData.get("goal") ? JSON.parse(formData.get("goal") as string) : undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { bodyweightKg, goal } = parsed.data;

  try {
    // Atomically log bodyweight, create goal if provided, mark onboarding complete
    await prisma.$transaction(async (tx) => {
      // Log initial bodyweight if provided
      if (bodyweightKg !== null && bodyweightKg !== undefined) {
        await tx.bodyMetric.create({
          data: {
            userId,
            type: "BODYWEIGHT",
            date: new Date(),
            value: bodyweightKg,
          },
        });
      }

      // Create goal if provided
      if (goal) {
        await tx.goal.create({
          data: {
            userId,
            type: goal.type,
            title: goal.title,
            targetDate: goal.targetDate,
            status: goal.status || "ACTIVE",
            config: goal.config,
          },
        });
      }

      // Mark onboarding complete
      await tx.user.update({
        where: { id: userId },
        data: { onboardingComplete: true },
      });
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return { error: "Failed to complete onboarding. Please try again." };
  }

  redirect("/dashboard");
}
