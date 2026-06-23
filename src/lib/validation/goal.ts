import { z } from "zod";

import { BODY_METRIC_TYPES, GOAL_STATUSES } from "@/lib/constants";

// Goal input (SPEC.md §5.5). The `config` JSON shape is discriminated by `type`
// (SPEC.md §4.2): STRENGTH | BODY_METRIC | CONSISTENCY. Using a discriminated
// union guarantees the config matches the goal type at validation time.

const baseGoalFields = {
  title: z.string().trim().min(1, "Title is required.").max(120),
  targetDate: z.coerce.date().nullable().optional(),
  status: z.enum(GOAL_STATUSES).default("ACTIVE"),
};

export const strengthGoalConfigSchema = z.object({
  exerciseId: z.string().min(1, "Exercise is required."),
  metric: z.enum(["1RM", "weightForReps"]),
  targetValueKg: z.number().positive(),
  reps: z.number().int().positive().optional(),
  startingValueKg: z.number().min(0).optional(),
});

export const bodyMetricGoalConfigSchema = z.object({
  metricType: z.enum(BODY_METRIC_TYPES),
  startingValue: z.number(),
  targetValue: z.number(),
  // direction removed — inferred from startingValue vs targetValue
});

export const consistencyGoalConfigSchema = z.object({
  workoutsPerWeek: z.number().int().positive(),
  windowStart: z.coerce.date().optional(),
  windowEnd: z.coerce.date().optional(),
});

export const goalSchema = z.discriminatedUnion("type", [
  z.object({
    ...baseGoalFields,
    type: z.literal("STRENGTH"),
    config: strengthGoalConfigSchema,
  }),
  z.object({
    ...baseGoalFields,
    type: z.literal("BODY_METRIC"),
    config: bodyMetricGoalConfigSchema,
  }),
  z.object({
    ...baseGoalFields,
    type: z.literal("CONSISTENCY"),
    config: consistencyGoalConfigSchema,
  }),
]);

export const setGoalStatusSchema = z.object({
  goalId: z.string().min(1),
  status: z.enum(GOAL_STATUSES),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type SetGoalStatusInput = z.infer<typeof setGoalStatusSchema>;
