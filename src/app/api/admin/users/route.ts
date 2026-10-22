import { createAdminUser, createAdminUserSchema, listAdminUsers } from "@/features/admin-users/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

/** GET /api/admin/users — owner only. */
export const GET = adminRoute("owner", async () => jsonOk(await listAdminUsers()));

/** POST /api/admin/users — owner creates an account; the temporary password is returned once. */
export const POST = adminRoute("owner", async ({ request, admin }) => {
  const input = await readJson(request, createAdminUserSchema);
  return jsonOk(await createAdminUser({ ...input, actor: auditActor(admin) }), { status: 201 });
});
