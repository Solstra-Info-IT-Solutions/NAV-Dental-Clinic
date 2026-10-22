import "server-only";

import type { AdminRole } from "@/lib/auth/auth";
import { requireAdmin, type AdminUser } from "@/lib/auth/guards";
import { connectToDatabase } from "@/lib/db/connection";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

import { assertSameOrigin, jsonError } from "./http";

type Handler<P> = (args: { request: Request; params: P; admin: AdminUser }) => Promise<Response>;

/**
 * Every admin Route Handler goes through this wrapper:
 * same-origin check for mutations → database → session + role check →
 * per-user rate limit → handler. Errors use the shared envelope.
 */
export function adminRoute<P = Record<string, never>>(role: AdminRole, handler: Handler<P>) {
  return async (request: Request, context: { params: Promise<P> }): Promise<Response> => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") assertSameOrigin(request);
      await connectToDatabase();
      const admin = await requireAdmin(request.headers, role);
      await enforceRateLimit(RATE_LIMITS.admin, admin.id);
      const response = await handler({ request, params: await context.params, admin });
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      return jsonError(error);
    }
  };
}
