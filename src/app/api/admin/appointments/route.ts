import { after } from "next/server";

import { appointmentListQuerySchema, createManualAppointment, listAppointments, manualAppointmentSchema } from "@/features/appointments/admin";
import { notifyAppointmentEvent } from "@/features/notifications/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";
import { parseOrThrow } from "@/lib/validation";

/** GET /api/admin/appointments — paginated, filterable list (phones masked). */
export const GET = adminRoute("staff", async ({ request }) => {
  const query = parseOrThrow(appointmentListQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const { items, page } = await listAppointments(query);
  return Response.json({ data: items, page });
});

/** POST /api/admin/appointments — manual (phone/walk-in) booking. */
export const POST = adminRoute("staff", async ({ request, admin }) => {
  const input = await readJson(request, manualAppointmentSchema);
  const { appointment, replayed } = await createManualAppointment(input, auditActor(admin));
  if (!replayed && input.notifyPatient) {
    after(() => notifyAppointmentEvent(appointment._id, input.status === "confirmed" ? "confirmed" : "received"));
  }
  return jsonOk({ id: String(appointment._id), reference: appointment.reference }, { status: replayed ? 200 : 201 });
});
