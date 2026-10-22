import { getPublishedServices } from "@/features/services/queries";
import { CACHE_PUBLIC, jsonError, jsonOk } from "@/lib/api/http";

/** GET /api/public/services — published services, summary fields only. */
export async function GET() {
  try {
    const services = await getPublishedServices();
    return jsonOk(
      services.map(({ slug, title, summary, bookable }) => ({ slug, title, summary, bookable })),
      { cache: CACHE_PUBLIC },
    );
  } catch (error) {
    return jsonError(error);
  }
}
