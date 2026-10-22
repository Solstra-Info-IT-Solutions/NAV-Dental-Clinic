import { z } from "zod";

import { ENQUIRY_STATUSES } from "@/features/enquiries/schemas";
import { listEnquiries } from "@/features/enquiries/service";
import { adminRoute } from "@/lib/api/admin-route";
import { maskPhone } from "@/lib/logger";
import { parseOrThrow } from "@/lib/validation";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(ENQUIRY_STATUSES))),
  q: z.string().trim().max(60).optional(),
});

/** GET /api/admin/enquiries — paginated list, phones masked. */
export const GET = adminRoute("staff", async ({ request }) => {
  const query = parseOrThrow(querySchema, Object.fromEntries(new URL(request.url).searchParams));
  const { items, page } = await listEnquiries(query);
  return Response.json({
    data: items.map((e) => ({
      id: String(e._id),
      name: e.name,
      phoneMasked: maskPhone(e.phoneE164),
      category: e.category,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
    page,
  });
});
