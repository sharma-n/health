import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const postSessionSetSchema = z.object({
  weightKg: z.number().nonnegative().optional(),
  reps: z.number().int().positive().optional(),
  restSeconds: z.number().int().nonnegative().optional(),
});

const postSessionExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.array(postSessionSetSchema).min(1),
});

const postSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workoutId: z.string().optional(),
  planId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  overallEffort: z.number().int().min(1).max(10).optional(),
  exercises: z.array(postSessionExerciseSchema).min(1),
});

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = Math.min(365, Math.max(1, parseInt(daysParam ?? "30", 10) || 30));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      endedAt: { not: null },
      startedAt: { gte: since },
    },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      overallEffort: true,
      notes: true,
      workout: { select: { name: true } },
      exercises: {
        select: {
          order: true,
          exercise: { select: { id: true, name: true } },
          sets: {
            where: { completed: true },
            select: {
              setNumber: true,
              weightKg: true,
              reps: true,
            },
            orderBy: { setNumber: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  const result = sessions.map((s) => ({
    id: s.id,
    date: s.startedAt.toISOString().slice(0, 10),
    workoutName: s.workout?.name ?? null,
    durationMinutes: s.durationSeconds ? Math.round(s.durationSeconds / 60) : null,
    overallEffort: s.overallEffort,
    notes: s.notes,
    exercises: s.exercises.map((ex) => ({
      id: ex.exercise.id,
      name: ex.exercise.name,
      sets: ex.sets.map((set) => ({
        setNumber: set.setNumber,
        weightKg: set.weightKg,
        reps: set.reps,
      })),
    })),
  }));

  return NextResponse.json(result);
}

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

  const parsed = postSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { date, workoutId, planId, notes, overallEffort, exercises } = parsed.data;

  if (workoutId) {
    const workout = await prisma.workout.findFirst({ where: { id: workoutId, ownerId: userId }, select: { id: true } });
    if (!workout) return NextResponse.json({ error: "Workout not found" }, { status: 400 });
  }
  if (planId) {
    const plan = await prisma.plan.findFirst({ where: { id: planId, ownerId: userId }, select: { id: true } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 400 });
  }

  const sessionDate = new Date(date);

  try {
    const session = await prisma.$transaction(async (tx) => {
      const s = await tx.session.create({
        data: {
          userId,
          workoutId: workoutId ?? null,
          planId: planId ?? null,
          startedAt: sessionDate,
          endedAt: sessionDate,
          durationSeconds: null,
          overallEffort: overallEffort ?? null,
          notes: notes ?? null,
        },
        select: { id: true },
      });

      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const se = await tx.sessionExercise.create({
          data: { sessionId: s.id, exerciseId: ex.exerciseId, order: i },
          select: { id: true },
        });

        for (let j = 0; j < ex.sets.length; j++) {
          const set = ex.sets[j];
          await tx.sessionSet.create({
            data: {
              sessionExerciseId: se.id,
              setNumber: j + 1,
              weightKg: set.weightKg ?? null,
              reps: set.reps ?? null,
              restSeconds: set.restSeconds ?? null,
              completed: true,
            },
          });
        }
      }

      return s;
    });

    return NextResponse.json({ id: session.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
