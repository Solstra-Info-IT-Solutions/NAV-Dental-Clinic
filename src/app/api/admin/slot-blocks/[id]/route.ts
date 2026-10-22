import { deleteSlotBlock } from "@/features/schedule/service";
import { adminRoute } from "@/lib/api/admin-route";
import { auditActor } from "@/lib/auth/guards";

/** DELETE /api/admin/slot-blocks/{id} — releases the blocked times. */
export const DELETE = adminRoute<{ id: string }>("staff", async ({ params, admin }) => {
  await deleteSlotBlock(params.id, auditActor(admin));
  return new Response(null, { status: 204 });
});
