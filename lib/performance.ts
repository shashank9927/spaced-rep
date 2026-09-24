import "server-only";

import { headers } from "next/headers";

/**
 * Lightweight request diagnostics. This intentionally logs neither user data
 * nor Supabase responses so it is safe to enable in production temporarily.
 */
export async function measure<T>(label: string, work: () => T | PromiseLike<T>, details?: Record<string, string | number | boolean | undefined>): Promise<Awaited<T>> {
  const startedAt = performance.now();
  let result: Awaited<T> | undefined;
  try {
    result = await work();
    return result;
  } finally {
    if (process.env.PERF_LOGGING === "true") {
      const durationMs = Math.round(performance.now() - startedAt);
      // The proxy creates this opaque ID. It lets a production trace group a
      // route's queries without recording a user identity, token, or cookie.
      const requestHeaders = await headers();
      const payload = result as { data?: unknown } | undefined;
      const rows = Array.isArray(payload?.data) ? payload.data.length : payload?.data == null ? 0 : 1;
      console.info("[performance]", {
        correlationId: requestHeaders.get("x-request-id") ?? "unknown",
        route: requestHeaders.get("x-route") ?? "unknown",
        label,
        durationMs,
        rows,
        ...details,
      });
    }
  }
}
