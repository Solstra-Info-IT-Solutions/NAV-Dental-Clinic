import { availableDates } from "@/features/appointments/service";
import { availableDatesQuerySchema } from "@/features/appointments/schemas";
import { clientIp, jsonError, jsonOk } from "@/lib/api/http";
import { connectToDatabase } from "@/lib/db/connection";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseOrThrow } from "@/lib/validation";

/** GET /api/public/available-dates?service=slug[&from=YYYY-MM-DD][&days=14] */
export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = parseOrThrow(availableDatesQuerySchema, params);
    await connectToDatabase();
    await enforceRateLimit(RATE_LIMITS.slots, clientIp(request));
    return jsonOk(await availableDates(query.service, { from: query.from, days: query.days }));
  } catch (error) {
    return jsonError(error);
  }
}
