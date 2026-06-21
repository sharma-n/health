"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  workoutIdSchema,
  workoutSchema,
  updateWorkoutSchema,
  type WorkoutExerciseInput,
} from "@/lib/validation/workout";

export type WorkoutFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

const NOT_FOUND: WorkoutFormState = { error: "Workout not found." };

async function workoutRateLimited(userId: string): Promise<boolean> {
  const ip = await getClientIp();
  const key = ip ? `workout:${ip}` : `workout:user:${userId}`;
  return !checkRateLimit(key, 30, 5 * 60 * 1000);
}

function parseExercises(formData: FormData): unknown {
  try {
    return JSON.parse((formData.get("exercises") as string) ?? "[]");
  } catch {
    return [];
  }
}

export async function createWorkoutAction(
  _prev: WorkoutFormState,
  formData: FormData,
): Promise<WorkoutFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await workoutRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const exercises = parseExercises(formData);
  const parsed = workoutSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    exercises,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const workout = await prisma.workout.create({
    data: {
      ownerId: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      notes: parsed.data.notes,
      exercises: {
        createMany: {
          data: (parsed.data.exercises as WorkoutExerciseInput[]).map(
            (ex, idx) => ({
              exerciseId: ex.exerciseId,
              order: idx,
              targetSets: ex.targetSets ?? null,
              targetReps: ex.targetReps ?? null,
              targetWeightKg: ex.targetWeightKg ?? null,
              restSeconds: ex.restSeconds ?? null,
              supersetGroup: ex.supersetGroup ?? null,
              notes: ex.notes ?? null,
            }),
          ),
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/workouts");
  redirect(`/workouts/${workout.id}`);
}

export async function updateWorkoutAction(
  _prev: WorkoutFormState,
  formData: FormData,
): Promise<WorkoutFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await workoutRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const exercises = parseExercises(formData);
  const parsed = updateWorkoutSchema.safeParse({
    workoutId: formData.get("workoutId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    exercises,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { workoutId, ...fields } = parsed.data;

  const existing = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { ownerId: true },
  });

  if (!existing || existing.ownerId !== userId) return NOT_FOUND;

  await prisma.workout.update({
    where: { id: workoutId, ownerId: userId },
    data: {
      name: fields.name,
      description: fields.description,
      notes: fields.notes,
      exercises: {
        deleteMany: {},
        createMany: {
          data: (fields.exercises as WorkoutExerciseInput[]).map(
            (ex, idx) => ({
              exerciseId: ex.exerciseId,
              order: idx,
              targetSets: ex.targetSets ?? null,
              targetReps: ex.targetReps ?? null,
              targetWeightKg: ex.targetWeightKg ?? null,
              restSeconds: ex.restSeconds ?? null,
              supersetGroup: ex.supersetGroup ?? null,
              notes: ex.notes ?? null,
            }),
          ),
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/workouts");
  revalidatePath(`/workouts/${workoutId}`);
  redirect(`/workouts/${workoutId}`);
}

export async function deleteWorkoutAction(
  _prev: WorkoutFormState,
  formData: FormData,
): Promise<WorkoutFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await workoutRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = workoutIdSchema.safeParse({
    workoutId: formData.get("workoutId"),
  });
  if (!parsed.success) return NOT_FOUND;

  const { workoutId } = parsed.data;

  const existing = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { ownerId: true },
  });

  if (!existing || existing.ownerId !== userId) return NOT_FOUND;

  await prisma.workout.delete({
    where: { id: workoutId, ownerId: userId },
  });

  revalidatePath("/workouts");
  redirect("/workouts");
}
