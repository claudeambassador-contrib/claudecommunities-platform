// Lightweight in-process per-IP rate limiter.
//
// Caveat: each serverless function instance has its own Map, so an attacker
// hitting a freshly cold-started instance gets a fresh budget. This is a
// best-effort first line of defence — it stops casual scripted abuse and
// raises the cost of automated attacks. For real protection, swap the
// storage for Upstash Redis (drop-in: same interface, async get/set).
//
// Usage in a route handler:
//   const limited = rateLimit(req, { limit: 10, windowMs: 60_000 })
//   if (limited) return limited
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window length in ms */
  windowMs: number;
  /** Optional bucket key prefix (e.g. route name) so different routes don't share counters */
  key?: string;
}

/**
 * Returns a 429 Response if the caller is over the limit, otherwise null.
 * Caller should `return` the response directly when non-null.
 */
export function rateLimit(req: Request, opts: RateLimitOptions): Response | null {
  const ip = clientIp(req);
  const bucketKey = `${opts.key ?? "default"}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + opts.windowMs });
    // Opportunistic cleanup so the Map doesn't grow forever
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return null;
  }

  if (existing.count >= opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    });
  }

  existing.count++;
  return null;
}
