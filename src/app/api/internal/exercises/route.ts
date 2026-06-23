import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { exerciseSchema } from "@/lib/validation/exercise";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const equipment = req.nextUrl.searchParams.get("equipment") ?? "";

  const exercises = await prisma.exercise.findMany({
    where: {
      AND: [
        { OR: [{ ownerId: userId }, { isSystem: true }] },
        { isArchived: false },
        ...(q ? [{ name: { contains: q } }] : []),
        ...(equipment ? [{ equipment }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      equipment: true,
      primaryMuscles: true,
      secondaryMuscles: true,
      isSystem: true,
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return NextResponse.json(exercises);
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

  const parsed = exerciseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, description, equipment, primaryMuscles, secondaryMuscles, instructions, commonPitfalls } = parsed.data;

  try {
    const exercise = await prisma.exercise.create({
      data: {
        ownerId: userId,
        isSystem: false,
        isArchived: false,
        name,
        description,
        equipment,
        primaryMuscles,
        secondaryMuscles,
        instructions,
        commonPitfalls,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: exercise.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create exercise" }, { status: 500 });
  }
}
