import { z } from "zod";
import { goalSchema } from "./goal";

// Onboarding flow (M7): collect initial bodyweight + optional first goal
export const onboardingSchema = z.object({
  bodyweightKg: z.coerce.number().positive("Weight must be greater than zero.").nullable().optional(),
  // Goal fields are optional; if type is set, config is required
  goal: goalSchema.optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
