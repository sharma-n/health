import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "../_auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { bodyMetricSchema } from "@/lib/validation/body-metric";

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

  const parsed = bodyMetricSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { date, type, value, note } = parsed.data;

  try {
    const metric = await prisma.bodyMetric.create({
      data: {
        userId,
        date,
        type,
        value,
        note: note ?? null,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: metric.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to log metric" }, { status: 500 });
  }
}
