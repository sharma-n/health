// Unit conversion helpers. Canonical storage is ALWAYS kilograms for weight and
// centimetres for length (SPEC.md §4, §10.1); conversion happens only at the
// display/input boundary, driven by the user's `unitPreference`.
//
// `unitPreference` is "KG" | "LBS" and governs BOTH systems: KG → metric
// (kg, cm), LBS → imperial (lbs, inches).

import type { UnitPreference } from "@/lib/constants";

const LBS_PER_KG = 2.2046226218487757;
const CM_PER_INCH = 2.54;

/** Convert a user-entered weight (in their unit) to canonical kg for storage. */
export function toKg(value: number, unit: UnitPreference): number {
  return unit === "LBS" ? value / LBS_PER_KG : value;
}

/** Convert a stored weight (kg) to the user's unit for display. */
export function fromKg(kg: number, unit: UnitPreference): number {
  return unit === "LBS" ? kg * LBS_PER_KG : kg;
}

/** Convert a user-entered length (in their unit) to canonical cm for storage. */
export function toCm(value: number, unit: UnitPreference): number {
  return unit === "LBS" ? value * CM_PER_INCH : value;
}

/** Convert a stored length (cm) to the user's unit for display. */
export function fromCm(cm: number, unit: UnitPreference): number {
  return unit === "LBS" ? cm / CM_PER_INCH : cm;
}

/** Display label for the weight unit. */
export function weightUnitLabel(unit: UnitPreference): "kg" | "lbs" {
  return unit === "LBS" ? "lbs" : "kg";
}

/** Display label for the length unit. */
export function lengthUnitLabel(unit: UnitPreference): "cm" | "in" {
  return unit === "LBS" ? "in" : "cm";
}
