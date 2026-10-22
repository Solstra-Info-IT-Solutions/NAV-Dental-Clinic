import { createSlotBlock, slotBlockSchema } from "@/features/schedule/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

/** POST /api/admin/slot-blocks — block times (409 with conflicts if already booked). */
export const POST = adminRoute("staff", async ({ request, admin }) => {
  const input = await readJson(request, slotBlockSchema);
  return jsonOk(await createSlotBlock(input, auditActor(admin)), { status: 201 });
});
