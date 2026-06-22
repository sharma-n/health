import { z } from "zod";

import { PLAN_STATUSES } from "@/lib/constants";

// Plan/routine input (SPEC.md §5.3). A plan is a date range plus a weekly
// schedule mapping day-of-week (0=Sun..6=Sat) to workouts. Dates are date-only
// in concept; store as UTC midnight (SPEC.md §10.1).

export const planScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  workoutId: z.string().min(1, "Workout is required."),
});

export const planSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    description: z.string().trim().max(2000).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z.enum(PLAN_STATUSES).default("DRAFT"),
    schedule: z.array(planScheduleItemSchema).default([]),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export const setPlanStatusSchema = z.object({
  planId: z.string().min(1),
  status: z.enum(PLAN_STATUSES),
});

export const planIdSchema = z.object({ planId: z.string().min(1) });

export const updatePlanSchema = planSchema.and(planIdSchema);

export type PlanScheduleItemInput = z.infer<typeof planScheduleItemSchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type SetPlanStatusInput = z.infer<typeof setPlanStatusSchema>;
export type PlanIdInput = z.infer<typeof planIdSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
