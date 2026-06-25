import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const startSessionSchema = z.object({
  workoutId: z.string().optional(),
  planId: z.string().optional(),
  exerciseIds: z.array(z.string().min(1)).optional(),
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

  const parsed = startSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { workoutId, planId, exerciseIds } = parsed.data;

  if (workoutId) {
    const workout = await prisma.workout.findFirst({ where: { id: workoutId, ownerId: userId }, select: { id: true } });
    if (!workout) return NextResponse.json({ error: "Workout not found" }, { status: 400 });
  }
  if (planId) {
    const plan = await prisma.plan.findFirst({ where: { id: planId, ownerId: userId }, select: { id: true } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 400 });
  }

  try {
    const session = await prisma.$transaction(async (tx) => {
      const s = await tx.session.create({
        data: {
          userId,
          workoutId: workoutId ?? null,
          planId: planId ?? null,
          startedAt: new Date(),
          endedAt: null,
        },
        select: { id: true },
      });

      if (exerciseIds && exerciseIds.length > 0) {
        await tx.sessionExercise.createMany({
          data: exerciseIds.map((exerciseId, i) => ({
            sessionId: s.id,
            exerciseId,
            order: i,
          })),
        });
      }

      return s;
    });

    const sessionUrl = `/sessions/${session.id}`;
    return NextResponse.json({ sessionId: session.id, sessionUrl }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }
}
