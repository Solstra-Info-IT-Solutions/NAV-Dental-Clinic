import { availableSlots } from "@/features/appointments/service";
import { slotsQuerySchema } from "@/features/appointments/schemas";
import { clientIp, jsonError, jsonOk } from "@/lib/api/http";
import { connectToDatabase } from "@/lib/db/connection";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseOrThrow } from "@/lib/validation";

/** GET /api/public/slots?date=YYYY-MM-DD&service=slug — never cached: availability changes constantly. */
export async function GET(request: Request) {
  try {
    const query = parseOrThrow(slotsQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
    await connectToDatabase();
    await enforceRateLimit(RATE_LIMITS.slots, clientIp(request));
    return jsonOk(await availableSlots(query.service, query.date));
  } catch (error) {
    return jsonError(error);
  }
}
