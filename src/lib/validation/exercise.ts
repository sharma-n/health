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
  instructions: z.string().trim().max(5000, "Instructions are too long.").optional(),
  commonPitfalls: z.string().trim().max(2000, "Common pitfalls text is too long.").optional(),
});

export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const updateExerciseSchema = exerciseSchema.extend({
  exerciseId: z.string().min(1, "Exercise ID is required."),
});

export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;

export const exerciseIdSchema = z.object({
  exerciseId: z.string().min(1, "Exercise ID is required."),
});

export type ExerciseIdInput = z.infer<typeof exerciseIdSchema>;

export const cloneExerciseSchema = z.object({
  exerciseId: z.string().min(1, "Exercise ID is required."),
  name: z.string().trim().min(1).max(120).optional(),
});

export type CloneExerciseInput = z.infer<typeof cloneExerciseSchema>;

export const exerciseFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  muscle: z.enum(MUSCLE_GROUPS).optional(),
  scope: z.enum(["all", "mine", "system"]).default("all"),
});

export type ExerciseFilter = z.infer<typeof exerciseFilterSchema>;
