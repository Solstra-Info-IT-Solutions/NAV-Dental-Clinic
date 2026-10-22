import { updateAdminUser, updateAdminUserSchema } from "@/features/admin-users/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

/** PATCH /api/admin/users/{id} — role, enable/disable, password reset (owner). */
export const PATCH = adminRoute<{ id: string }>("owner", async ({ request, params, admin }) => {
  const body = await readJson(request, updateAdminUserSchema);
  return jsonOk(await updateAdminUser({ userId: params.id, ...body, actor: auditActor(admin) }));
});
