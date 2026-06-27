import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { getPlanAdherence } from "@/lib/analytics/plan-adherence";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, timezone } = auth;

  const planId = req.nextUrl.searchParams.get("planId");
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 });

  try {
    const result = await getPlanAdherence(planId, userId, prisma, timezone);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
