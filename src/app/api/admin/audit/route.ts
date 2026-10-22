import { z } from "zod";

import { listAudit } from "@/features/audit/service";
import { adminRoute } from "@/lib/api/admin-route";
import { parseOrThrow } from "@/lib/validation";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
  entity: z.string().max(40).optional(),
  entityId: z.string().max(60).optional(),
});

/** GET /api/admin/audit — owner only. */
export const GET = adminRoute("owner", async ({ request }) => {
  const { items, page } = await listAudit(parseOrThrow(querySchema, Object.fromEntries(new URL(request.url).searchParams)));
  return Response.json({ data: items, page });
});
