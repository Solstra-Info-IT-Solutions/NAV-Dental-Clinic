import { z } from "zod";

import { getScheduleDay } from "@/features/schedule/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk } from "@/lib/api/http";
import { parseOrThrow } from "@/lib/validation";

/** GET /api/admin/schedule?date=YYYY-MM-DD — the day grid per chair. */
export const GET = adminRoute("staff", async ({ request }) => {
  const { date } = parseOrThrow(z.object({ date: z.string() }), Object.fromEntries(new URL(request.url).searchParams));
  return jsonOk(await getScheduleDay(date));
});
