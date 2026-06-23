import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { planSchema } from "@/lib/validation/plan";

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

  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, description, startDate, endDate, schedule } = parsed.data;

  // Verify every workoutId in the schedule belongs to this user
  if (schedule.length > 0) {
    const workoutIds = schedule.map((s) => s.workoutId);
    const owned = await prisma.workout.findMany({
      where: { id: { in: workoutIds }, ownerId: userId },
      select: { id: true },
    });
    if (owned.length !== workoutIds.length) {
      return NextResponse.json({ error: "One or more workouts not found" }, { status: 400 });
    }
  }

  try {
    const plan = await prisma.plan.create({
      data: {
        ownerId: userId,
        name,
        description,
        startDate,
        endDate,
        status: "DRAFT",
        schedule: {
          createMany: {
            data: schedule.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              workoutId: s.workoutId,
            })),
          },
        },
      },
      select: { id: true },
    });
    return NextResponse.json({ id: plan.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
