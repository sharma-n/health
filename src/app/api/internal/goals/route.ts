import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";
import { computeGoalProgress } from "@/lib/analytics/goals";
import { checkRateLimit } from "@/lib/rate-limit";
import { goalSchema } from "@/lib/validation/goal";

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
        config: g.config,
        progress,
      };
    }),
  );

  return NextResponse.json(withProgress);
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

  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { type, title, targetDate, status, config } = parsed.data;

  try {
    const goal = await prisma.goal.create({
      data: {
        userId,
        type,
        title,
        targetDate: targetDate ?? null,
        status,
        config,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: goal.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
