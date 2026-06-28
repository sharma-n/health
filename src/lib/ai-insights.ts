export async function getAiInsights(
  userId: string,
): Promise<Record<string, string> | null> {
  const base = process.env.AGENT_SERVICE_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!base || !secret) return null;
  try {
    const res = await fetch(`${base}/v1/user-facts`, {
      headers: { "x-internal-secret": secret, "x-user-id": userId },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const { facts } = (await res.json()) as { facts: Record<string, string> };
    if (!facts || typeof facts !== "object") return null;
    return Object.keys(facts).length > 0 ? facts : null;
  } catch {
    return null;
  }
}
