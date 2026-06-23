import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { getExerciseProgression } from "@/lib/analytics/progression";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const exerciseId = req.nextUrl.searchParams.get("exerciseId");
  if (!exerciseId)
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });

  const progression = await getExerciseProgression(userId, exerciseId, prisma);
  return NextResponse.json(progression);
}
