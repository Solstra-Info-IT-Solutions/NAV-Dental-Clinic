import { after } from "next/server";
import { z } from "zod";

import { rescheduleAppointment } from "@/features/appointments/service";
import { notifyAppointmentEvent } from "@/features/notifications/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

const bodySchema = z.object({
  start: z.iso.datetime(),
  note: z.string().trim().max(500).optional(),
  notifyPatient: z.boolean().default(true),
});

/** POST /api/admin/appointments/{id}/reschedule — atomic move of the slot holds. */
export const POST = adminRoute<{ id: string }>("staff", async ({ request, params, admin }) => {
  const body = await readJson(request, bodySchema);
  const updated = await rescheduleAppointment({ appointmentId: params.id, start: new Date(body.start), note: body.note, actor: auditActor(admin) });
  if (body.notifyPatient) after(() => notifyAppointmentEvent(updated._id, "rescheduled"));
  return jsonOk({ id: String(updated._id), start: updated.start.toISOString(), status: updated.status });
});
