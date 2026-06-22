import { z } from "zod";

// Live session logging input (SPEC.md §5.4). A session is started from a
// workout template, a plan occurrence, or ad-hoc (all source ids null), then
// sets are logged per exercise. Weights are kg (canonical) by the time they
// reach here.

export const startSessionSchema = z.object({
  workoutId: z.string().min(1).nullable().optional(),
  planId: z.string().min(1).nullable().optional(),
  scheduledDate: z.coerce.date().nullable().optional(),
});

export const sessionSetSchema = z.object({
  setNumber: z.number().int().positive(),
  weightKg: z.number().nonnegative().nullable().optional(),
  reps: z.number().int().nonnegative().nullable().optional(),
  completed: z.boolean().default(false),
  restSeconds: z.number().int().nonnegative().nullable().optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
});

// Upsert a single set during live logging.
export const upsertSetSchema = sessionSetSchema.extend({
  sessionExerciseId: z.string().min(1),
  id: z.string().min(1).optional(),
});

// Record actual rest taken for a set.
export const setRestSchema = z.object({
  setId: z.string().min(1),
  restSeconds: z.number().int().nonnegative(),
});

// Finish a session: overall effort (1..10 RPE) + notes.
export const completeSessionSchema = z.object({
  sessionId: z.string().min(1),
  overallEffort: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

// Add an exercise to an in-progress session (ad-hoc or mid-session add).
export const addExerciseToSessionSchema = z.object({
  sessionId: z.string().cuid(),
  exerciseId: z.string().cuid(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type SessionSetInput = z.infer<typeof sessionSetSchema>;
export type UpsertSetInput = z.infer<typeof upsertSetSchema>;
export type SetRestInput = z.infer<typeof setRestSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
export type AddExerciseToSessionInput = z.infer<typeof addExerciseToSessionSchema>;
