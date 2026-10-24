import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/config/site";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { getPublishedServices } from "@/features/services/queries";

/**
 * sitemap.xml — public, indexable pages only. Published services come from the
 * database; draft legal pages (noindex) and private areas are excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, services] = await Promise.all([getPublicSettings(), getPublishedServices()]);
  const core: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/appointment", priority: 0.9, changeFrequency: "weekly" },
    { path: "/services", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  ];
  const legal = settings.legalPagesApproved
    ? [
        { path: "/privacy-policy", priority: 0.2, changeFrequency: "yearly" as const },
        { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
      ]
    : [];

  return [
    ...core,
    ...services.map((s) => ({ path: `/services/${s.slug}`, priority: 0.7, changeFrequency: "monthly" as const })),
    ...legal,
  ].map(({ path, priority, changeFrequency }) => ({ url: absoluteUrl(path), priority, changeFrequency }));
}
