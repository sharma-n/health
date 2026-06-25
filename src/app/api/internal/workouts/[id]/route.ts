import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";

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
