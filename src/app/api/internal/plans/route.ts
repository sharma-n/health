import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const status = req.nextUrl.searchParams.get("status");

  const plans = await prisma.plan.findMany({
    where: {
      ownerId: userId,
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      schedule: {
        select: {
          dayOfWeek: true,
          workout: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    startDate: p.startDate.toISOString().slice(0, 10),
    endDate: p.endDate.toISOString().slice(0, 10),
    schedule: Object.fromEntries(
      p.schedule.map((item) => [
        item.dayOfWeek,
        { workoutId: item.workout.id, workoutName: item.workout.name },
      ]),
    ),
  }));

  return NextResponse.json(result);
}
