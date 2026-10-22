import { z } from "zod";

import { ENQUIRY_STATUSES } from "@/features/enquiries/schemas";
import { getEnquiry, updateEnquiry } from "@/features/enquiries/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

const patchSchema = z.object({ status: z.enum(ENQUIRY_STATUSES).optional(), note: z.string().trim().min(1).max(1000).optional() });

export const GET = adminRoute<{ id: string }>("staff", async ({ params }) => jsonOk(await getEnquiry(params.id)));

/** PATCH /api/admin/enquiries/{id} — status and/or internal note. */
export const PATCH = adminRoute<{ id: string }>("staff", async ({ request, params, admin }) => {
  const body = await readJson(request, patchSchema);
  const updated = await updateEnquiry({ enquiryId: params.id, status: body.status, note: body.note, actor: auditActor(admin) });
  return jsonOk({ id: String(updated._id), status: updated.status });
});
