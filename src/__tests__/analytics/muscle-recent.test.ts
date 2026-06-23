import { getMuscleRecentVolume } from "@/lib/analytics/muscle-recent";
import type { PrismaClient } from "@/generated/prisma/client";

function makePrisma(sessionExercises: object[]): PrismaClient {
  return {
    sessionExercise: { findMany: vi.fn().mockResolvedValue(sessionExercises) },
  } as unknown as PrismaClient;
}

describe("getMuscleRecentVolume", () => {
  it("returns empty object when no sessions", async () => {
    const result = await getMuscleRecentVolume("u", makePrisma([]));
    expect(result).toEqual({});
  });

  it("counts completed sets per primary muscle group", async () => {
    const sessionExercises = [
      {
        exercise: { primaryMuscles: ["QUADS"] },
        sets: [{ id: "s1" }, { id: "s2" }, { id: "s3" }], // 3 completed sets
      },
      {
        exercise: { primaryMuscles: ["QUADS", "GLUTES"] },
        sets: [{ id: "s4" }], // 1 completed set per muscle
      },
    ];
    const result = await getMuscleRecentVolume("u", makePrisma(sessionExercises));
    expect(result.QUADS).toBe(4); // 3 + 1
    expect(result.GLUTES).toBe(1);
  });

  it("skips session exercises with no completed sets", async () => {
    const sessionExercises = [
      {
        exercise: { primaryMuscles: ["CHEST"] },
        sets: [],
      },
    ];
    const result = await getMuscleRecentVolume("u", makePrisma(sessionExercises));
    expect(result.CHEST).toBeUndefined();
  });

  it("accumulates across multiple exercises for the same muscle", async () => {
    const sessionExercises = [
      { exercise: { primaryMuscles: ["BACK"] }, sets: [{ id: "s1" }, { id: "s2" }] },
      { exercise: { primaryMuscles: ["BACK"] }, sets: [{ id: "s3" }] },
    ];
    const result = await getMuscleRecentVolume("u", makePrisma(sessionExercises));
    expect(result.BACK).toBe(3);
  });
});
