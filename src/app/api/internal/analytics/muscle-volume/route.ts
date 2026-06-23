import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { getMuscleVolumeByWeek } from "@/lib/analytics/volume";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const weeksParam = req.nextUrl.searchParams.get("weeks");
  const weeks = Math.min(52, Math.max(1, parseInt(weeksParam ?? "8", 10) || 8));

  const data = await getMuscleVolumeByWeek(userId, prisma, weeks);
  return NextResponse.json(data);
}
