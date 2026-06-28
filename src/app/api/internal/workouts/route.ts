import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const workouts = await prisma.workout.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { exercises: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = workouts.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    exerciseCount: w._count.exercises,
  }));

  return NextResponse.json(result);
}

// Internal schema: order is assigned from array index, not required in body
const internalExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  targetSets: z.number().int().positive().nullable().optional(),
  targetReps: z.number().int().positive().nullable().optional(),
  targetWeightKg: z.number().nonnegative().nullable().optional(),
  restSeconds: z.number().int().nonnegative().nullable().optional(),
  supersetGroup: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const postBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  exercises: z.array(internalExerciseSchema).default([]),
});

export async function POST(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  if (!checkRateLimit(`internal-write:${userId}`, 30, 5 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, description, notes, exercises } = parsed.data;

  try {
    const workout = await prisma.workout.create({
      data: {
        ownerId: userId,
        name,
        description,
        notes,
        exercises: {
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
        },
      },
      select: { id: true },
    });
    return NextResponse.json({ id: workout.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create workout" }, { status: 500 });
  }
}
