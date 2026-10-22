import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/config/env.server";
import { processDueNotifications } from "@/features/notifications/service";
import { jsonError, jsonOk } from "@/lib/api/http";
import { connectToDatabase } from "@/lib/db/connection";
import { AppError } from "@/lib/errors";

function authorised(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** GET /api/cron/notifications — Vercel Cron retries failed notifications. Requires Bearer CRON_SECRET. */
export async function GET(request: Request) {
  try {
    if (!authorised(request)) throw new AppError("UNAUTHENTICATED");
    await connectToDatabase();
    return jsonOk(await processDueNotifications());
  } catch (error) {
    return jsonError(error);
  }
}
