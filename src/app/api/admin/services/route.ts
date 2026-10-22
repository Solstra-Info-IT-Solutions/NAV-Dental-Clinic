import { revalidateTag } from "next/cache";

import { createService, listAllServices, serviceInputSchema } from "@/features/services/admin";
import { SERVICES_TAG } from "@/features/services/queries";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

/** GET /api/admin/services — all services incl. drafts (owner). */
export const GET = adminRoute("owner", async () => jsonOk(await listAllServices()));

/** POST /api/admin/services — create a service (owner). */
export const POST = adminRoute("owner", async ({ request, admin }) => {
  const input = await readJson(request, serviceInputSchema);
  const created = await createService(input, auditActor(admin));
  revalidateTag(SERVICES_TAG, { expire: 0 });
  return jsonOk(created, { status: 201 });
});
