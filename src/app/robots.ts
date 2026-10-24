import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { buildRobotsRules, indexingFromEnv } from "@/lib/seo/indexing";

/** robots.txt — private areas are always disallowed; non-production builds disallow everything. */
export default function robots(): MetadataRoute.Robots {
  return buildRobotsRules(indexingFromEnv(), siteConfig.url);
}
