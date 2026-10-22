import { deleteClosure } from "@/features/schedule/service";
import { adminRoute } from "@/lib/api/admin-route";
import { auditActor } from "@/lib/auth/guards";

/** DELETE /api/admin/closures/{id} — owner only. */
export const DELETE = adminRoute<{ id: string }>("owner", async ({ params, admin }) => {
  await deleteClosure(params.id, auditActor(admin));
  return new Response(null, { status: 204 });
});
