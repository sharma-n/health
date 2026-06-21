import { z } from "zod";

import { EQUIPMENT, MUSCLE_GROUPS } from "@/lib/constants";

// Exercise create/edit input (SPEC.md §5.1). Muscle lists are stored as JSON
// columns; validate the contents against MUSCLE_GROUPS here.

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
  description: z.string().trim().max(2000, "Description is too long.").optional(),
  equipment: z.enum(EQUIPMENT),
  primaryMuscles: z
    .array(z.enum(MUSCLE_GROUPS))
    .min(1, "Pick at least one primary muscle."),
  secondaryMuscles: z.array(z.enum(MUSCLE_GROUPS)).default([]),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;
