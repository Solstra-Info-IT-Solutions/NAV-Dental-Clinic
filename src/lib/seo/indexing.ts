/**
 * Decides whether search engines may index this deployment. Kept free of
 * path aliases so next.config.ts and proxy.ts can import it.
 *
 * Indexable only when the canonical URL is a real HTTPS domain and this is a
 * production deployment. Local, preview and staging builds are never indexed.
 * SITE_INDEXING=off|on overrides the automatic decision (e.g. a staging host).
 */
export type IndexingInput = { siteUrl: string; vercelEnv?: string; override?: string };

const NON_PUBLIC_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$|\.(local|localhost|test|internal)$/i;

export function isIndexable({ siteUrl, vercelEnv, override }: IndexingInput): boolean {
  if (override === "off") return false;
  let url: URL;
  try {
    url = new URL(siteUrl);
  } catch {
    return false;
  }
  if (override === "on") return true;
  if (url.protocol !== "https:" || NON_PUBLIC_HOST.test(url.hostname)) return false;
  return vercelEnv === undefined || vercelEnv === "" || vercelEnv === "production";
}

export function indexingFromEnv(): boolean {
  return isIndexable({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    vercelEnv: process.env.VERCEL_ENV,
    override: process.env.SITE_INDEXING,
  });
}

/** Paths that must never appear in search results. */
export const PRIVATE_PATHS = ["/admin", "/api", "/appointment/status"] as const;

export function buildRobotsRules(indexable: boolean, siteUrl: string) {
  return indexable
    ? { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS.map((p) => `${p}`) }], sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
