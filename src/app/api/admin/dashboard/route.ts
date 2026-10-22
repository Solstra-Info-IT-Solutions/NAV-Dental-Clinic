import { dashboardSummary } from "@/features/appointments/admin";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk } from "@/lib/api/http";

/** GET /api/admin/dashboard — counts straight from the database. */
export const GET = adminRoute("staff", async () => jsonOk(await dashboardSummary()));
