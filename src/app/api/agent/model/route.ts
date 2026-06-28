import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  model: z.string().nullable(),
});

export async function PUT(req: Request): Promise<Response> {
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

  const agentUrl = process.env.AGENT_SERVICE_URL;
  if (!agentUrl) {
    return Response.json({ error: "Agent service not configured" }, { status: 503 });
  }

  const upstream = await fetch(`${agentUrl}/v1/model`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
      "X-User-Id": userId,
    },
    body: JSON.stringify({
      conversation_id: parsed.data.conversationId,
      model: parsed.data.model,
    }),
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    const status = upstream?.status ?? 503;
    return Response.json({ error: "Agent service unavailable" }, { status: status >= 500 ? 502 : status });
  }

  return Response.json(await upstream.json());
}
