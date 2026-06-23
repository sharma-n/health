import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";
import { computeGoalProgress } from "@/lib/analytics/goals";

export async function GET(req: NextRequest) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  const goals = await prisma.goal.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      targetDate: true,
      config: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const withProgress = await Promise.all(
    goals.map(async (g) => {
      const progress = await computeGoalProgress(
        { userId, type: g.type, config: g.config },
        prisma,
      );
      return {
        id: g.id,
        type: g.type,
        title: g.title,
        status: g.status,
        targetDate: g.targetDate?.toISOString().slice(0, 10) ?? null,
        createdAt: g.createdAt.toISOString().slice(0, 10),
        progress,
      };
    }),
  );

  return NextResponse.json(withProgress);
}
