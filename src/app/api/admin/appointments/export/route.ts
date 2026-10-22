import { z } from "zod";

import { exportAppointmentsCsv } from "@/features/appointments/admin";
import { APPOINTMENT_STATUSES_LIST } from "@/features/appointments/status-machine";
import { recordAudit } from "@/features/audit/service";
import { adminRoute } from "@/lib/api/admin-route";
import { auditActor } from "@/lib/auth/guards";
import { parseOrThrow } from "@/lib/validation";

const querySchema = z.object({
  from: z.string(),
  to: z.string(),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(APPOINTMENT_STATUSES_LIST))),
});

/** GET /api/admin/appointments/export — owner-only CSV of minimal fields; audited. */
export const GET = adminRoute("owner", async ({ request, admin }) => {
  const query = parseOrThrow(querySchema, Object.fromEntries(new URL(request.url).searchParams));
  const csv = await exportAppointmentsCsv(query);
  await recordAudit({
    actor: auditActor(admin),
    action: "appointments.exported",
    entity: "appointment",
    entityId: "export",
    changes: [{ field: "range", to: `${query.from}..${query.to}` }],
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointments-${query.from}-to-${query.to}.csv"`,
    },
  });
});
