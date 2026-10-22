import { statusLookupSchema } from "@/features/appointments/schemas";
import { lookupAppointmentStatus } from "@/features/appointments/service";
import { assertSameOrigin, clientIp, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { connectToDatabase } from "@/lib/db/connection";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

/**
 * POST /api/public/appointments/status — POST so the phone number never
 * appears in URLs or access logs. Requires reference AND mobile number.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await connectToDatabase();
    await enforceRateLimit(RATE_LIMITS.appointmentStatusIp, clientIp(request));
    const { reference, phone } = await readJson(request, statusLookupSchema);
    return jsonOk(await lookupAppointmentStatus(reference, phone));
  } catch (error) {
    return jsonError(error);
  }
}
