import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { internalExerciseSchema } from "../route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const { id } = await params;

  const workout = await prisma.workout.findFirst({
    where: { id, ownerId: userId },
    select: {
      id: true,
      name: true,
      exercises: {
        select: {
          exerciseId: true,
          order: true,
          targetSets: true,
          targetReps: true,
          targetWeightKg: true,
          exercise: { select: { name: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: workout.id,
    name: workout.name,
    exercises: workout.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.exercise.name,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      targetWeightKg: ex.targetWeightKg,
      order: ex.order,
    })),
  });
}

const patchBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  exercises: z.array(internalExerciseSchema).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  if (!checkRateLimit(`internal-write:${userId}`, 30, 5 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, description, notes, exercises } = parsed.data;

  const existing = await prisma.workout.findFirst({
    where: { id, ownerId: userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (notes !== undefined) updateData.notes = notes;
  if (exercises !== undefined) {
    updateData.exercises = {
      deleteMany: {},
      createMany: {
        data: exercises.map((ex, i) => ({
          exerciseId: ex.exerciseId,
          order: i,
          targetSets: ex.targetSets ?? null,
          targetReps: ex.targetReps ?? null,
          targetWeightKg: ex.targetWeightKg ?? null,
          restSeconds: ex.restSeconds ?? null,
          supersetGroup: ex.supersetGroup ?? null,
          notes: ex.notes ?? null,
        })),
      },
    };
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await prisma.workout.update({ where: { id }, data: updateData, select: { id: true } });
  return NextResponse.json({ id }, { status: 200 });
}
