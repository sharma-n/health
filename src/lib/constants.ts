// String-backed "enums". SQLite (via Prisma) has no native enum type, so these
// values are stored as plain strings and enforced in the app layer (Zod).
// See SPEC.md §4.1.

export const UNIT_PREFERENCES = ["KG", "LBS"] as const;
export type UnitPreference = (typeof UNIT_PREFERENCES)[number];
export const DEFAULT_UNIT_PREFERENCE: UnitPreference = "KG";

export const PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const DEFAULT_PLAN_STATUS: PlanStatus = "DRAFT";

export const GOAL_TYPES = ["STRENGTH", "BODY_METRIC", "CONSISTENCY"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "FAILED", "ARCHIVED"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const DEFAULT_GOAL_STATUS: GoalStatus = "ACTIVE";

export const EQUIPMENT = [
  "BARBELL",
  "DUMBBELL",
  "MACHINE",
  "CABLE",
  "KETTLEBELL",
  "BODYWEIGHT",
  "BAND",
  "OTHER",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MUSCLE_GROUPS = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "FOREARMS",
  "QUADS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "ABS",
  "OBLIQUES",
  "TRAPS",
  "LATS",
  "NECK",
  "FULL_BODY",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const BODY_METRIC_TYPES = [
  "BODYWEIGHT",
  "WAIST",
  "HIPS",
  "CHEST",
  "ARM_LEFT",
  "ARM_RIGHT",
  "THIGH_LEFT",
  "THIGH_RIGHT",
  "CALF",
  "NECK",
  "BODY_FAT_PCT",
] as const;
export type BodyMetricType = (typeof BODY_METRIC_TYPES)[number];
