import "server-only";

import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { z } from "zod";

import { siteConfig } from "@/config/site";
import { AppError, errorBody, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parseOrThrow } from "@/lib/validation";

export const MAX_BODY_BYTES = 16 * 1024;

export const CACHE_PUBLIC = "public, s-maxage=60, stale-while-revalidate=300";
export const CACHE_NONE = "no-store";

export function jsonOk<T>(data: T, init: { status?: number; cache?: string; headers?: HeadersInit } = {}) {
  const response = NextResponse.json({ data }, { status: init.status ?? 200, headers: init.headers });
  response.headers.set("Cache-Control", init.cache ?? CACHE_NONE);
  return response;
}

export function jsonError(error: unknown) {
  // Let Next.js's own control-flow errors (dynamic-rendering bail-outs during
  // prerender, notFound, redirect) propagate instead of becoming a 500.
  unstable_rethrow(error);
  const appError = toAppError(error);
  const requestId = crypto.randomUUID();
  if (appError.status >= 500) {
    logger.error("api.error", { requestId, code: appError.code, error: appError.cause ?? appError });
  }
  const response = NextResponse.json(errorBody(appError, requestId), { status: appError.status });
  response.headers.set("Cache-Control", CACHE_NONE);
  const retryAfter = appError.details?.retryAfter;
  if (typeof retryAfter === "number") response.headers.set("Retry-After", String(retryAfter));
  return response;
}

/**
 * Reads and validates a JSON body with a hard size limit. The limit is
 * enforced on the actual bytes read, not only the Content-Length header.
 */
export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType)) throw new AppError("UNSUPPORTED_MEDIA_TYPE");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new AppError("PAYLOAD_TOO_LARGE");

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_BODY_BYTES) throw new AppError("PAYLOAD_TOO_LARGE");

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new AppError("BAD_REQUEST", { message: "The request body is not valid JSON." });
  }
  return parseOrThrow(schema, body);
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defence for mutations: the request must come from this site.
 * Accepts the canonical origin, or the request's own origin (preview
 * deployments and local development), and the browser's Sec-Fetch-Site.
 */
export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") throw new AppError("FORBIDDEN");

  const origin = request.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-origin POSTs; a missing Origin
    // without Sec-Fetch-Site is a non-browser client, which we do not serve.
    if (!fetchSite) throw new AppError("FORBIDDEN");
    return;
  }
  const allowed = new Set([originOf(siteConfig.url), originOf(request.url)]);
  if (!allowed.has(originOf(origin))) throw new AppError("FORBIDDEN");
}

/** Best-effort client IP (Vercel/most proxies set x-forwarded-for). Only ever stored hashed. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
