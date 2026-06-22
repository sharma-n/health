"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  startSessionSchema,
  upsertSetSchema,
  setRestSchema,
  completeSessionSchema,
  addExerciseToSessionSchema,
  type UpsertSetInput,
} from "@/lib/validation/session";

export type SessionFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  sessionExerciseId?: string;
  setId?: string;
};

const NOT_FOUND: SessionFormState = { error: "Session not found." };

async function sessionRateLimited(userId: string): Promise<boolean> {
  const ip = await getClientIp();
  const key = ip ? `session:${ip}` : `session:user:${userId}`;
  return !checkRateLimit(key, 30, 5 * 60 * 1000);
}

// --------------------------------------------------------------------------
// Start a session from a workout template, a plan occurrence, or ad-hoc.
// Used as a direct <form action> — redirects on success, silently stays on
// error (validation failures are prevented by the server-rendered form).
// --------------------------------------------------------------------------
export async function startSessionAction(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const parsed = startSessionSchema.safeParse({
    workoutId: formData.get("workoutId") || undefined,
    planId: formData.get("planId") || undefined,
    scheduledDate: formData.get("scheduledDate") || undefined,
  });
  if (!parsed.success) return;

  const { workoutId, planId, scheduledDate } = parsed.data;

  // If workoutId provided, verify ownership before using it.
  if (workoutId) {
    const workout = await prisma.workout.findUnique({
      where: { id: workoutId },
      select: { ownerId: true },
    });
    if (!workout || workout.ownerId !== userId) return;
  }

  const newSession = await prisma.session.create({
    data: {
      userId,
      workoutId: workoutId ?? null,
      planId: planId ?? null,
      scheduledDate: scheduledDate ?? null,
      startedAt: new Date(),
    },
    select: { id: true },
  });

  // Pre-populate exercises from the workout template, preserving order.
  if (workoutId) {
    const workoutExercises = await prisma.workoutExercise.findMany({
      where: { workoutId },
      select: { exerciseId: true, order: true },
      orderBy: { order: "asc" },
    });

    if (workoutExercises.length > 0) {
      await prisma.sessionExercise.createMany({
        data: workoutExercises.map((we) => ({
          sessionId: newSession.id,
          exerciseId: we.exerciseId,
          order: we.order,
        })),
      });
    }
  }

  revalidatePath("/sessions");
  redirect(`/sessions/${newSession.id}`);
}

// --------------------------------------------------------------------------
// Add an exercise to an in-progress session (ad-hoc or mid-session extension).
// Called directly from client code (not via form).
// --------------------------------------------------------------------------
export async function addExerciseToSessionAction(
  sessionId: string,
  exerciseId: string,
): Promise<SessionFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await sessionRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = addExerciseToSessionSchema.safeParse({ sessionId, exerciseId });
  if (!parsed.success) return { error: "Invalid input." };

  const existing = await prisma.session.findUnique({
    where: { id: parsed.data.sessionId },
    select: { userId: true, endedAt: true, _count: { select: { exercises: true } } },
  });
  if (!existing || existing.userId !== userId) return NOT_FOUND;
  if (existing.endedAt) return { error: "Session already completed." };

  const se = await prisma.sessionExercise.create({
    data: {
      sessionId: parsed.data.sessionId,
      exerciseId: parsed.data.exerciseId,
      order: existing._count.exercises,
    },
    select: { id: true },
  });

  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  return { success: "Exercise added.", sessionExerciseId: se.id };
}

// --------------------------------------------------------------------------
// Create or update a single set during live logging. Called directly from
// client code. Returns the persisted set ID for optimistic state updates.
// --------------------------------------------------------------------------
export async function upsertSetAction(
  data: UpsertSetInput,
): Promise<SessionFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await sessionRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = upsertSetSchema.safeParse(data);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Ownership chain: SessionExercise → Session → userId
  const se = await prisma.sessionExercise.findUnique({
    where: { id: parsed.data.sessionExerciseId },
    select: { session: { select: { userId: true, endedAt: true } } },
  });
  if (!se || se.session.userId !== userId) return NOT_FOUND;
  if (se.session.endedAt) return { error: "Session already completed." };

  const { id, ...fields } = parsed.data;

  let setId: string;
  if (id) {
    const updated = await prisma.sessionSet.update({
      where: { id },
      data: fields,
      select: { id: true },
    });
    setId = updated.id;
  } else {
    const created = await prisma.sessionSet.create({
      data: {
        sessionExerciseId: fields.sessionExerciseId,
        setNumber: fields.setNumber,
        weightKg: fields.weightKg ?? null,
        reps: fields.reps ?? null,
        completed: fields.completed,
        restSeconds: fields.restSeconds ?? null,
        durationSeconds: fields.durationSeconds ?? null,
      },
      select: { id: true },
    });
    setId = created.id;
  }

  return { success: "Set saved.", setId };
}

// --------------------------------------------------------------------------
// Record actual rest taken after a set completes (rest timer fires/skipped).
// --------------------------------------------------------------------------
export async function setRestAction(
  setId: string,
  restSeconds: number,
): Promise<SessionFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await sessionRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = setRestSchema.safeParse({ setId, restSeconds });
  if (!parsed.success) return { error: "Invalid input." };

  // Ownership chain: SessionSet → SessionExercise → Session → userId
  const existingSet = await prisma.sessionSet.findUnique({
    where: { id: parsed.data.setId },
    select: {
      sessionExercise: {
        select: { session: { select: { userId: true, endedAt: true } } },
      },
    },
  });
  if (!existingSet || existingSet.sessionExercise.session.userId !== userId) {
    return NOT_FOUND;
  }
  if (existingSet.sessionExercise.session.endedAt) {
    return { error: "Session already completed." };
  }

  await prisma.sessionSet.update({
    where: { id: parsed.data.setId },
    data: { restSeconds: parsed.data.restSeconds },
    select: { id: true },
  });

  return { success: "Rest recorded." };
}

// --------------------------------------------------------------------------
// Finish a session: record end time, duration, overall effort, and notes.
// --------------------------------------------------------------------------
export async function completeSessionAction(
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await sessionRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const parsed = completeSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    overallEffort: formData.get("overallEffort")
      ? Number(formData.get("overallEffort"))
      : undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { sessionId, overallEffort, notes } = parsed.data;

  const existing = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true, startedAt: true, endedAt: true },
  });
  if (!existing || existing.userId !== userId) return NOT_FOUND;
  if (existing.endedAt) return { error: "Session already completed." };

  const endedAt = new Date();
  const durationSeconds = Math.floor(
    (endedAt.getTime() - existing.startedAt.getTime()) / 1000,
  );

  await prisma.session.update({
    where: { id: sessionId, userId },
    data: { endedAt, durationSeconds, overallEffort: overallEffort ?? null, notes: notes ?? null },
    select: { id: true },
  });

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}`);
}

// --------------------------------------------------------------------------
// Delete a session and all its exercises/sets (cascade handles children).
// --------------------------------------------------------------------------
export async function deleteSessionAction(
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Unauthorized." };

  if (await sessionRateLimited(userId)) {
    return { error: "Too many requests. Please wait a moment." };
  }

  const sessionId = formData.get("sessionId");
  if (!sessionId || typeof sessionId !== "string") return NOT_FOUND;

  const existing = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!existing || existing.userId !== userId) return NOT_FOUND;

  await prisma.session.delete({ where: { id: sessionId, userId } });

  revalidatePath("/sessions");
  redirect("/sessions");
}
