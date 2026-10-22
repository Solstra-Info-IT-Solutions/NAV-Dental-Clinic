import "server-only";

import { createHash } from "node:crypto";

import { rateLimitSalt } from "@/config/env.server";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import { RateLimitModel } from "@/lib/db/models";

/** Salted one-way hash for identifiers (IP, phone) used in limits and request metadata. */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(`${rateLimitSalt()}:${value}`).digest("hex");
}

export type RateLimitRule = { scope: string; limit: number; windowSeconds: number };

/** Limits from docs/API_DOCUMENTATION.md §0. */
export const RATE_LIMITS = {
  slots: { scope: "slots:ip", limit: 60, windowSeconds: 60 },
  appointmentCreateIp: { scope: "appointments.create:ip", limit: 5, windowSeconds: 600 },
  appointmentCreatePhone: { scope: "appointments.create:phone", limit: 3, windowSeconds: 86_400 },
  appointmentStatusIp: { scope: "appointments.status:ip", limit: 10, windowSeconds: 600 },
  enquiryCreateIp: { scope: "enquiries.create:ip", limit: 3, windowSeconds: 600 },
  enquiryCreatePhone: { scope: "enquiries.create:phone", limit: 5, windowSeconds: 86_400 },
  signInIp: { scope: "auth.sign-in:ip", limit: 5, windowSeconds: 900 },
  signInEmail: { scope: "auth.sign-in:email", limit: 10, windowSeconds: 3_600 },
  admin: { scope: "admin:user", limit: 300, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window counter stored in MongoDB: one atomic upsert + $inc per
 * request. Works across serverless instances without extra infrastructure.
 * Expired windows are removed by the TTL index on `expiresAt`.
 */
export async function consumeRateLimit(rule: RateLimitRule, identifier: string, now = new Date()): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const key = hashIdentifier(`${rule.scope}:${identifier}`);

  const increment = () =>
    RateLimitModel.findOneAndUpdate(
      { key, windowStart },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" },
    )
      .lean()
      .exec();

  let doc;
  try {
    doc = await increment();
  } catch (error) {
    // Two first requests in the same window can race on the upsert; the loser retries once.
    if (!isDuplicateKeyError(error)) throw error;
    doc = await increment();
  }

  const count = doc?.count ?? 1;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Throws 429 RATE_LIMITED (with Retry-After) when the limit is exceeded. */
export async function enforceRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const result = await consumeRateLimit(rule, identifier);
  if (!result.allowed) throw new AppError("RATE_LIMITED", { details: { retryAfter: result.retryAfterSeconds } });
}
