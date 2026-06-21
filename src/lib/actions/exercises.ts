"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  cloneExerciseSchema,
  exerciseIdSchema,
  exerciseSchema,
  updateExerciseSchema,
} from "@/lib/validation/exercise";

export type ExerciseFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

const NOT_FOUND: ExerciseFormState = { error: "Exercise not found." };

async function exerciseRateLimited(userId: string): Promise<boolean> {
  const ip = await getClientIp();
  const key = ip ? `exercise:${ip}` : `exercise:user:${userId}`;
  return !checkRateLimit(key, 30, 5 * 60 * 1000);
}

function parseMuscleLists(formData: FormData): {
  primaryMuscles: unknown;
  secondaryMuscles: unknown;
} {
  let primaryMuscles: unknown = [];
  let secondaryMuscles: unknown = [];
  try {
    primaryMuscles = JSON.parse(
      (formData.get("primaryMuscles") as string) ?? "[]",
    );
  } catch {
    primaryMuscles = [];
  }
  try {
    secondaryMuscles = JSON.parse(
      (formData.get("secondaryMuscles") as string) ?? "[]",
    );
  } catch {
    secondaryMuscles = [];
  }
  return { primaryMuscles, secondaryMuscles };
}

export async function createExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await exerciseRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const { primaryMuscles, secondaryMuscles } = parseMuscleLists(formData);
  const parsed = exerciseSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    equipment: formData.get("equipment"),
    primaryMuscles,
    secondaryMuscles,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.exercise.create({
    data: {
      ownerId: userId,
      isSystem: false,
      isArchived: false,
      name: parsed.data.name,
      description: parsed.data.description,
      equipment: parsed.data.equipment,
      primaryMuscles: parsed.data.primaryMuscles,
      secondaryMuscles: parsed.data.secondaryMuscles,
      instructions: parsed.data.instructions,
      commonPitfalls: parsed.data.commonPitfalls,
    },
    select: { id: true },
  });

  revalidatePath("/exercises");
  redirect("/exercises");
}

export async function updateExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await exerciseRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const { primaryMuscles, secondaryMuscles } = parseMuscleLists(formData);
  const parsed = updateExerciseSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    equipment: formData.get("equipment"),
    primaryMuscles,
    secondaryMuscles,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { exerciseId, ...fields } = parsed.data;

  const existing = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { ownerId: true, isSystem: true },
  });

  if (!existing) return NOT_FOUND;
  if (existing.isSystem)
    return {
      error: "System exercises are read-only. Use 'Clone & Edit' to create your own copy.",
    };
  if (existing.ownerId !== userId) return NOT_FOUND;

  await prisma.exercise.update({
    where: { id: exerciseId, ownerId: userId },
    data: fields,
    select: { id: true },
  });

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${exerciseId}`);
  redirect(`/exercises/${exerciseId}`);
}

export async function archiveExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await exerciseRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = exerciseIdSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
  });
  if (!parsed.success) return NOT_FOUND;

  const existing = await prisma.exercise.findUnique({
    where: { id: parsed.data.exerciseId },
    select: { ownerId: true, isSystem: true },
  });

  if (!existing || existing.ownerId !== userId || existing.isSystem) {
    return NOT_FOUND;
  }

  await prisma.exercise.update({
    where: { id: parsed.data.exerciseId, ownerId: userId },
    data: { isArchived: true },
    select: { id: true },
  });

  revalidatePath("/exercises");
  return { success: "Exercise archived." };
}

export async function unarchiveExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await exerciseRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = exerciseIdSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
  });
  if (!parsed.success) return NOT_FOUND;

  const existing = await prisma.exercise.findUnique({
    where: { id: parsed.data.exerciseId },
    select: { ownerId: true, isSystem: true },
  });

  if (!existing || existing.ownerId !== userId || existing.isSystem) {
    return NOT_FOUND;
  }

  await prisma.exercise.update({
    where: { id: parsed.data.exerciseId, ownerId: userId },
    data: { isArchived: false },
    select: { id: true },
  });

  revalidatePath("/exercises");
  return { success: "Exercise restored." };
}

export async function deleteExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await exerciseRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = exerciseIdSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
  });
  if (!parsed.success) return NOT_FOUND;

  const { exerciseId } = parsed.data;

  const existing = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { ownerId: true, isSystem: true },
  });

  if (!existing || existing.ownerId !== userId || existing.isSystem) {
    return NOT_FOUND;
  }

  const [workoutRefs, sessionRefs] = await Promise.all([
    prisma.workoutExercise.count({ where: { exerciseId } }),
    prisma.sessionExercise.count({ where: { exerciseId } }),
  ]);

  if (workoutRefs > 0 || sessionRefs > 0) {
    return {
      error:
        "This exercise is used in workouts or logged sessions. Archive it instead to hide it without losing your history.",
    };
  }

  await prisma.exercise.delete({
    where: { id: exerciseId, ownerId: userId },
  });

  revalidatePath("/exercises");
  redirect("/exercises");
}

export async function cloneExerciseAction(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await exerciseRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = cloneExerciseSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) return NOT_FOUND;

  const { exerciseId, name } = parsed.data;

  const source = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: {
      isSystem: true,
      ownerId: true,
      name: true,
      description: true,
      equipment: true,
      primaryMuscles: true,
      secondaryMuscles: true,
      instructions: true,
      commonPitfalls: true,
    },
  });

  if (!source) return NOT_FOUND;
  if (!source.isSystem && source.ownerId !== userId) return NOT_FOUND;

  const clone = await prisma.exercise.create({
    data: {
      ownerId: userId,
      isSystem: false,
      isArchived: false,
      name: name ?? `${source.name} (copy)`,
      description: source.description,
      equipment: source.equipment,
      primaryMuscles: (source.primaryMuscles ?? []) as string[],
      secondaryMuscles: (source.secondaryMuscles ?? []) as string[],
      instructions: source.instructions,
      commonPitfalls: source.commonPitfalls,
    },
    select: { id: true },
  });

  revalidatePath("/exercises");
  redirect(`/exercises/${clone.id}/edit`);
}
