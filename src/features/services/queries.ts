import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { connectToDatabase } from "@/lib/db/connection";

import type { ServiceContent } from "./catalog";
import { findPublishedServices } from "./repository";

export const SERVICES_TAG = "services";

/**
 * Published services in display order, cached and tagged so admin edits can
 * call revalidateTag(SERVICES_TAG).
 */
export async function getPublishedServices(): Promise<ServiceContent[]> {
  "use cache";
  cacheTag(SERVICES_TAG);
  cacheLife("hours");
  await connectToDatabase();
  return findPublishedServices();
}

export async function getPublishedService(slug: string): Promise<ServiceContent | null> {
  const services = await getPublishedServices();
  return services.find((s) => s.slug === slug) ?? null;
}
