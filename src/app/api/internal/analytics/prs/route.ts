import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { getPersonalRecords } from "@/lib/analytics/prs";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const prs = await getPersonalRecords(userId, prisma);
  return NextResponse.json(prs);
}
