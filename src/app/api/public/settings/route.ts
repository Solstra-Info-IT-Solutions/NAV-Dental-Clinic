import { getPublicSettings } from "@/features/clinic-settings/queries";
import { CACHE_PUBLIC, jsonError, jsonOk } from "@/lib/api/http";

/** GET /api/public/settings — public subset only (docs/API_DOCUMENTATION.md §1). */
export async function GET() {
  try {
    return jsonOk(await getPublicSettings(), { cache: CACHE_PUBLIC });
  } catch (error) {
    return jsonError(error);
  }
}
