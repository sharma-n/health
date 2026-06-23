import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!checkRateLimit(`agent:${userId}`, 60, 60_000)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { message, conversationId } = parsed.data;
  const conversation_id = conversationId ?? `health-${userId}`;

  const agentUrl = process.env.AGENT_SERVICE_URL;
  if (!agentUrl) {
    return Response.json({ error: "Agent service not configured" }, { status: 503 });
  }

  const upstream = await fetch(`${agentUrl}/v1/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
      "X-User-Id": userId,
      "X-User-Timezone": session.user.timezone ?? "UTC",
    },
    body: JSON.stringify({ message, conversation_id }),
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    const status = upstream?.status ?? 503;
    return Response.json({ error: "Agent service unavailable" }, { status: status >= 500 ? 502 : status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
