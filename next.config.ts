import type { NextConfig } from "next";

import { indexingFromEnv } from "./src/lib/seo/indexing";

// Decided per build: production deployments on the real domain only.
const INDEXABLE = indexingFromEnv();

// Baseline security headers. The nonce-based Content-Security-Policy is added
// in Phase 8 (see docs/SECURITY.md §4) because it needs per-request nonces.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

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
      { source: "/:path*", headers: securityHeaders },
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
