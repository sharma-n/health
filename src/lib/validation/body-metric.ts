import { z } from "zod";

import { BODY_METRIC_TYPES } from "@/lib/constants";

// Body-metric logging input (SPEC.md §5.6). `value` is canonical: kg for
// BODYWEIGHT, cm for lengths, % for BODY_FAT_PCT — converted from the user's
// unit before it reaches here.

export const bodyMetricSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(BODY_METRIC_TYPES),
  value: z.coerce.number().positive("Enter a value greater than zero."),
  note: z.string().trim().max(1000).nullable().optional(),
});

export type BodyMetricInput = z.infer<typeof bodyMetricSchema>;
