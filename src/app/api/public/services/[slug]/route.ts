import { getPublishedService } from "@/features/services/queries";
import { CACHE_PUBLIC, jsonError, jsonOk } from "@/lib/api/http";
import { AppError } from "@/lib/errors";

/** GET /api/public/services/{slug} — full published service, 404 otherwise. */
export async function GET(_request: Request, { params }: RouteContext<"/api/public/services/[slug]">) {
  try {
    const { slug } = await params;
    const service = await getPublishedService(slug);
    if (!service) throw new AppError("NOT_FOUND");
    return jsonOk(service, { cache: CACHE_PUBLIC });
  } catch (error) {
    return jsonError(error);
  }
}
