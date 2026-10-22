import { revalidateTag } from "next/cache";
import { z } from "zod";

import { CLINIC_SETTINGS_TAG } from "@/features/clinic-settings/queries";
import { getAdminSettings, updateSettings } from "@/features/clinic-settings/repository";
import { clinicSettingsInputSchema } from "@/features/clinic-settings/schemas";
import { adminRoute } from "@/lib/api/admin-route";
import { jsonOk, readJson } from "@/lib/api/http";
import { auditActor } from "@/lib/auth/guards";

const patchSchema = z.object({ version: z.number().int().min(1), changes: clinicSettingsInputSchema.partial() });

/** GET /api/admin/settings — full editable settings with version (owner). */
export const GET = adminRoute("owner", async () => jsonOk(await getAdminSettings()));

/** PATCH /api/admin/settings — optimistic-concurrency update; public pages refresh immediately. */
export const PATCH = adminRoute("owner", async ({ request, admin }) => {
  const { version, changes } = await readJson(request, patchSchema);
  await updateSettings({ expectedVersion: version, changes, actor: auditActor(admin) });
  revalidateTag(CLINIC_SETTINGS_TAG, { expire: 0 });
  return jsonOk(await getAdminSettings());
});
