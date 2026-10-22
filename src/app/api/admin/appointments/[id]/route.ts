import { getAppointmentDetail } from "@/features/appointments/admin";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk } from "@/lib/api/http";

/** GET /api/admin/appointments/{id} — full record incl. history, notes and notifications. */
export const GET = adminRoute<{ id: string }>("staff", async ({ params }) => jsonOk(await getAppointmentDetail(params.id)));
