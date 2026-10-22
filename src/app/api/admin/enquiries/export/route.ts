import { z } from "zod";

import { recordAudit } from "@/features/audit/service";
import { exportEnquiriesCsv } from "@/features/enquiries/service";
import { adminRoute } from "@/lib/api/admin-route";
import { auditActor } from "@/lib/auth/guards";
import { parseOrThrow } from "@/lib/validation";

/** GET /api/admin/enquiries/export — owner-only CSV (spam excluded); audited. */
export const GET = adminRoute("owner", async ({ request, admin }) => {
  const query = parseOrThrow(z.object({ from: z.string(), to: z.string() }), Object.fromEntries(new URL(request.url).searchParams));
  const csv = await exportEnquiriesCsv(query);
  await recordAudit({
    actor: auditActor(admin),
    action: "enquiries.exported",
    entity: "enquiry",
    entityId: "export",
    changes: [{ field: "range", to: `${query.from}..${query.to}` }],
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enquiries-${query.from}-to-${query.to}.csv"`,
    },
  });
});
