import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateInternalRequest } from "../../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const updateGoalSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  targetDate: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "ACHIEVED", "FAILED", "ARCHIVED"]).optional(),
  config: z.record(z.unknown()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = validateInternalRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = auth;

  if (!checkRateLimit(`internal-write:${userId}`, 30, 5 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { title, targetDate, status, config: configPatch } = parsed.data;

  const existing = await prisma.goal.findFirst({
    where: { id, userId },
    select: { config: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mergedConfig = configPatch
    ? { ...(existing.config as object), ...configPatch }
    : undefined;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;
  if (status !== undefined) updateData.status = status;
  if (mergedConfig !== undefined) updateData.config = mergedConfig;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await prisma.goal.updateMany({ where: { id, userId }, data: updateData });
  return NextResponse.json({ id }, { status: 200 });
}
