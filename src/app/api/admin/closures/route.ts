import { closureSchema, createClosure, listClosures } from "@/features/schedule/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

/** GET /api/admin/closures — current and upcoming closures. */
export const GET = adminRoute("staff", async () => jsonOk(await listClosures()));

/** POST /api/admin/closures — owner only; returns affected appointments (never cancels them). */
export const POST = adminRoute("owner", async ({ request, admin }) => {
  const input = await readJson(request, closureSchema);
  return jsonOk(await createClosure(input, auditActor(admin)), { status: 201 });
});
