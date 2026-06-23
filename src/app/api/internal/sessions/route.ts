import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";

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
          exercise: { select: { name: true } },
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
