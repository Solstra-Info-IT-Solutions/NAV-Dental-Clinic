import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { connectToDatabase } from "@/lib/db/connection";

import type { ServiceContent } from "./catalog";
import { findPublishedServices, findServiceRedirects } from "./repository";

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

/** Current slug for a renamed service's old slug, if any (cached with the services tag). */
export async function getServiceRedirect(oldSlug: string): Promise<string | null> {
  const map = await getServiceRedirectMap();
  return map[oldSlug] ?? null;
}

async function getServiceRedirectMap(): Promise<Record<string, string>> {
  "use cache";
  cacheTag(SERVICES_TAG);
  cacheLife("hours");
  await connectToDatabase();
  return findServiceRedirects();
}

