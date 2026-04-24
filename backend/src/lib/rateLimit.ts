/**
 * In-memory fixed-window rate limiter.
 * For multi-process or multi-server deployments, swap the Map for Redis.
 */
type Window = { hits: number; resetAt: number };
const store = new Map<string, Window>();

// Prune expired windows every minute so the Map doesn't grow unboundedly.
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of store) {
    if (now >= w.resetAt) store.delete(key);
  }
}, 60_000).unref();

/**
 * Increment the hit counter for `key` and return whether the request is allowed.
 * @param key      Unique key, e.g. `"login:${ip}"` or `"otp:${userId}"`
 * @param limit    Maximum hits allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  let w = store.get(key);

  if (!w || now >= w.resetAt) {
    store.set(key, { hits: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  if (w.hits >= limit) {
    return { ok: false, retryAfterMs: w.resetAt - now };
  }

  w.hits++;
  return { ok: true, retryAfterMs: 0 };
}
