// String-backed "enums". SQLite (via Prisma) has no native enum type, so these
// values are stored as plain strings and enforced in the app layer (Zod).
// See SPEC.md §4.1.

export const UNIT_PREFERENCES = ["KG", "LBS"] as const;
export type UnitPreference = (typeof UNIT_PREFERENCES)[number];
export const DEFAULT_UNIT_PREFERENCE: UnitPreference = "KG";
