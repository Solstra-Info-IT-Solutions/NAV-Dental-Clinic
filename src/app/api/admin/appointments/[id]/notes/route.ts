import { z } from "zod";

import { addAppointmentNote } from "@/features/appointments/admin";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

const bodySchema = z.object({ text: z.string().trim().min(1, "Write a note.").max(1000) });

/** POST /api/admin/appointments/{id}/notes — internal note, never shown to patients. */
export const POST = adminRoute<{ id: string }>("staff", async ({ request, params, admin }) => {
  const { text } = await readJson(request, bodySchema);
  await addAppointmentNote({ appointmentId: params.id, text, actor: auditActor(admin) });
  return jsonOk({ added: true }, { status: 201 });
});
