import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";

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
