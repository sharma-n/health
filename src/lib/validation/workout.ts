import { z } from "zod";

// Workout builder input (SPEC.md §5.2). A workout is an ordered list of
// exercises with per-exercise targets; exercises sharing a `supersetGroup`
// value form a superset. Weights are kg (canonical) by the time they reach here.

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().min(1, "Exercise is required."),
  order: z.number().int().min(0),
  targetSets: z.number().int().positive().nullable().optional(),
  targetReps: z.number().int().positive().nullable().optional(),
  targetWeightKg: z.number().nonnegative().nullable().optional(),
  restSeconds: z.number().int().nonnegative().nullable().optional(),
  supersetGroup: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const workoutSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
  description: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  exercises: z.array(workoutExerciseSchema).default([]),
});

// Drag-to-reorder: a list of exercise ids in their new order.
export const reorderWorkoutExercisesSchema = z.object({
  workoutId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)),
});

export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>;
export type WorkoutInput = z.infer<typeof workoutSchema>;
export type ReorderWorkoutExercisesInput = z.infer<
  typeof reorderWorkoutExercisesSchema
>;
