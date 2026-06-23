import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { getAdherenceStats } from "@/lib/analytics/adherence";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const stats = await getAdherenceStats(userId, prisma);
  return NextResponse.json(stats);
}
