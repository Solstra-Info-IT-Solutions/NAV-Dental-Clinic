import { revalidateTag } from "next/cache";

import { deleteService, getService, serviceInputSchema, updateService } from "@/features/services/admin";
import { SERVICES_TAG } from "@/features/services/queries";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

export const GET = adminRoute<{ id: string }>("owner", async ({ params }) => jsonOk(await getService(params.id)));

/** PUT /api/admin/services/{id} — full update; public pages refresh immediately. */
export const PUT = adminRoute<{ id: string }>("owner", async ({ request, params, admin }) => {
  const input = await readJson(request, serviceInputSchema);
  const updated = await updateService(params.id, input, auditActor(admin));
  revalidateTag(SERVICES_TAG, { expire: 0 });
  return jsonOk(updated);
});

/** DELETE /api/admin/services/{id} — refused (409) if appointments reference it. */
export const DELETE = adminRoute<{ id: string }>("owner", async ({ params, admin }) => {
  await deleteService(params.id, auditActor(admin));
  revalidateTag(SERVICES_TAG, { expire: 0 });
  return new Response(null, { status: 204 });
});
