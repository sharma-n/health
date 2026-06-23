import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";

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
