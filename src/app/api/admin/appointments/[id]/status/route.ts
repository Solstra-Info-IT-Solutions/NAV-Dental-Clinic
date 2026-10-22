import { after } from "next/server";
import { z } from "zod";

import { changeAppointmentStatus } from "@/features/appointments/service";
import { notifyAppointmentEvent } from "@/features/notifications/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

const bodySchema = z.object({
  to: z.enum(["confirmed", "reschedule_requested", "completed", "cancelled", "rejected", "no_show"]),
  note: z.string().trim().max(500).optional(),
  notifyPatient: z.boolean().default(true),
});

const PATIENT_EVENT: Partial<Record<z.infer<typeof bodySchema>["to"], "confirmed" | "cancelled" | "rejected">> = {
  confirmed: "confirmed",
  cancelled: "cancelled",
  rejected: "rejected",
};

/** POST /api/admin/appointments/{id}/status — transition enforced by the status machine. */
export const POST = adminRoute<{ id: string }>("staff", async ({ request, params, admin }) => {
  const body = await readJson(request, bodySchema);
  const updated = await changeAppointmentStatus({ appointmentId: params.id, to: body.to, note: body.note, actor: auditActor(admin) });
  const event = PATIENT_EVENT[body.to];
  if (event && body.notifyPatient) after(() => notifyAppointmentEvent(updated._id, event));
  return jsonOk({ id: String(updated._id), status: updated.status });
});
