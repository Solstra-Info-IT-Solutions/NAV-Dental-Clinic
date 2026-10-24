import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security/headers";
import { indexingFromEnv } from "./src/lib/seo/indexing";

// Decided per build: production deployments on the real domain only.
const INDEXABLE = indexingFromEnv();

// Security headers (CSP trade-offs documented in src/lib/security/headers.ts and docs/SECURITY.md).
const HTTPS = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const SECURITY_HEADERS = securityHeaders({ https: HTTPS, development: process.env.NODE_ENV === "development" });

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    // The parent folder (D:\) contains an unrelated lockfile; pin the project root.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // Private areas must never be indexed, whatever robots.txt says.
        source: "/(admin|api)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // Local, preview and staging builds: keep every page out of search results.
      ...(INDEXABLE ? [] : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]),
    ];
  },
};

export default nextConfig;
