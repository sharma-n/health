"use client";

import Model from "react-body-highlighter";
import type { IExerciseData, Muscle } from "react-body-highlighter";
import type { MuscleGroup } from "@/lib/constants";

const ANTERIOR_MUSCLES = new Set<Muscle>([
  "chest",
  "biceps",
  "forearm",
  "front-deltoids",
  "abs",
  "obliques",
  "quadriceps",
  "neck",
]);

const MUSCLE_MAP: Partial<Record<MuscleGroup, Muscle[]>> = {
  CHEST: ["chest"],
  BACK: ["upper-back", "lower-back"],
  SHOULDERS: ["front-deltoids", "back-deltoids"],
  BICEPS: ["biceps"],
  TRICEPS: ["triceps"],
  FOREARMS: ["forearm"],
  QUADS: ["quadriceps"],
  HAMSTRINGS: ["hamstring"],
  GLUTES: ["gluteal"],
  CALVES: ["calves"],
  ABS: ["abs"],
  OBLIQUES: ["obliques"],
  TRAPS: ["trapezius"],
  LATS: ["upper-back"],
  NECK: ["neck"],
  FULL_BODY: [
    "chest", "biceps", "forearm", "front-deltoids",
    "abs", "obliques", "quadriceps", "neck",
    "trapezius", "upper-back", "lower-back", "back-deltoids",
    "triceps", "hamstring", "gluteal", "calves",
  ],
};

const DEFAULT_COLORS: [string, string, string] = ["#f97316", "#ef4444", "#b91c1c"];

interface BodyMapProps {
  muscleIntensity: Partial<Record<MuscleGroup, number>>;
  maxIntensity?: number;
  colors?: [string, string, string];
  className?: string;
}

function buildModelData(
  muscleIntensity: Partial<Record<MuscleGroup, number>>,
  max: number,
  levels: number,
  view: "anterior" | "posterior",
): IExerciseData[] {
  const entries: IExerciseData[] = [];
  for (const [mg, rawCount] of Object.entries(muscleIntensity) as [MuscleGroup, number][]) {
    if (!rawCount || rawCount <= 0) continue;
    const libraryMuscles = MUSCLE_MAP[mg];
    if (!libraryMuscles) continue;
    const level = Math.min(levels, Math.ceil((rawCount / max) * levels));
    for (const libMuscle of libraryMuscles) {
      const isAnterior = ANTERIOR_MUSCLES.has(libMuscle);
      if (view === "anterior" && !isAnterior) continue;
      if (view === "posterior" && isAnterior) continue;
      entries.push({ name: mg, muscles: [libMuscle], frequency: level });
    }
  }
  return entries;
}

export function BodyMap({
  muscleIntensity,
  maxIntensity,
  colors = DEFAULT_COLORS,
  className,
}: BodyMapProps) {
  const values = Object.values(muscleIntensity).filter(
    (v): v is number => typeof v === "number" && v > 0,
  );
  const max = maxIntensity ?? Math.max(1, ...values);

  const anteriorData = buildModelData(muscleIntensity, max, colors.length, "anterior");
  const posteriorData = buildModelData(muscleIntensity, max, colors.length, "posterior");

  return (
    <div className={`flex items-center justify-center gap-4 ${className ?? ""}`}>
      <Model
        data={anteriorData}
        type="anterior"
        highlightedColors={colors}
        bodyColor="var(--color-border)"
        style={{ maxWidth: 140 }}
      />
      <Model
        data={posteriorData}
        type="posterior"
        highlightedColors={colors}
        bodyColor="var(--color-border)"
        style={{ maxWidth: 140 }}
      />
    </div>
  );
}
