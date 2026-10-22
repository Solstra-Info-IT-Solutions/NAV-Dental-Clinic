import { recordAudit } from "@/features/audit/service";
import { retryNotification } from "@/features/notifications/service";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";

/** POST /api/admin/notifications/{id}/retry — resend now. */
export const POST = adminRoute<{ id: string }>("staff", async ({ params, admin }) => {
  const result = await retryNotification(params.id);
  if (result === "skipped") throw new AppError("NOT_FOUND");
  await recordAudit({
    actor: auditActor(admin),
    action: "notification.retried",
    entity: "notification",
    entityId: params.id,
    changes: [{ field: "status", to: result }],
  });
  return jsonOk({ status: result });
});
