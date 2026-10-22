import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { SERVICE_CATALOG, type ServiceContent } from "./catalog";

export const SERVICES_TAG = "services";

/** Published services in display order. Phase 3 swaps in a MongoDB read. */
export async function getPublishedServices(): Promise<ServiceContent[]> {
  "use cache";
  cacheTag(SERVICES_TAG);
  cacheLife("hours");
  return SERVICE_CATALOG.filter((s) => s.published).sort((a, b) => a.order - b.order);
}

export async function getPublishedService(slug: string): Promise<ServiceContent | null> {
  const services = await getPublishedServices();
  return services.find((s) => s.slug === slug) ?? null;
}
