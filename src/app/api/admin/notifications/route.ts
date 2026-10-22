import { listNotificationAttempts } from "@/features/notifications/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk } from "@/lib/api/http";

/** GET /api/admin/notifications[?status=problems] */
export const GET = adminRoute("staff", async ({ request }) => {
  const problemsOnly = new URL(request.url).searchParams.get("status") === "problems";
  return jsonOk(await listNotificationAttempts({ problemsOnly }));
});
