import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

// Module-level store — lives for the lifetime of the Node process.
// Entries expire lazily on next access; stale keys accumulate only if an IP
// makes exactly one request and never returns, which is negligible at this scale.
const store = new Map<string, Bucket>();

/**
 * Returns true if the request is allowed, false if the key has exceeded its
 * limit within the current window.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count++;
  return true;
}

/**
 * Returns the client IP from the x-forwarded-for header (set by reverse
 * proxies). Returns null in bare local dev (no proxy) — callers skip limiting
 * when null so local testing is never blocked.
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (!forwarded) return null;
  return forwarded.split(",")[0].trim() || null;
}
