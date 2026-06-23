import { NextRequest } from "next/server";

export function validateInternalRequest(
  req: NextRequest,
): { userId: string } | null {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) return null;
  const userId = req.headers.get("x-user-id");
  if (!userId) return null;
  return { userId };
}
