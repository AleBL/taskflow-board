import { TRPCError } from "@trpc/server";
import { lt, sql } from "drizzle-orm";
import { rateLimits } from "../drizzle/schema";
import { getDb } from "./db";

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  demo: { limit: 10, windowMs: 60 * 60 * 1000 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export function getClientIp(req: RequestLike | undefined): string {
  const forwarded = req?.headers?.["x-forwarded-for"];
  const first = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0];
  if (first?.trim()) return first.trim();

  const realIp = req?.headers?.["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  return req?.socket?.remoteAddress ?? "unknown";
}

/**
 * Fixed-window counter stored in the database, because serverless instances
 * share no memory. Fails open: a broken limiter must not lock users out.
 */
export async function enforceRateLimit(
  name: RateLimitName,
  req: RequestLike | undefined
) {
  const { limit, windowMs } = RATE_LIMITS[name];
  const key = `${name}:${getClientIp(req)}`;
  const now = Date.now();
  const windowExpiredBefore = now - windowMs;

  let count: number;
  try {
    const db = getDb();
    const rows = await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} < ${windowExpiredBefore} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${windowExpiredBefore} THEN ${now} ELSE ${rateLimits.windowStart} END`,
        },
      })
      .returning({ count: rateLimits.count });
    count = rows[0]?.count ?? 1;
  } catch (error) {
    console.warn("[RateLimit] skipped:", String(error));
    return;
  }

  if (count > limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts, please try again later",
    });
  }
}

export async function purgeStaleRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  const db = getDb();
  await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, Date.now() - olderThanMs));
}
