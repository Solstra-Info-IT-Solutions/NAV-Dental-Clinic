import { z } from "zod";

import { staffSlots } from "@/features/appointments/admin";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk } from "@/lib/api/http";
import { parseOrThrow } from "@/lib/validation";

const querySchema = z.object({ service: z.string().max(60).optional(), date: z.string(), exclude: z.string().max(24).optional() });

/**
 * GET /api/admin/slots — free times for staff (minimum notice ignored).
 * `exclude` frees an appointment's own slot when rescheduling it.
 */
export const GET = adminRoute("staff", async ({ request }) => {
  const q = parseOrThrow(querySchema, Object.fromEntries(new URL(request.url).searchParams));
  return jsonOk(await staffSlots({ service: q.service, date: q.date, excludeAppointmentId: q.exclude }));
});
