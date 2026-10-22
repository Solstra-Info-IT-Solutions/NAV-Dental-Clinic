import { z } from "zod";

/**
 * Public, build-time site configuration. Only NEXT_PUBLIC_* values belong here;
 * server secrets are validated separately in src/config/env.server.ts (Phase 3).
 */
const siteEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .url({ protocol: /^https?$/ })
    .default("http://localhost:3000")
    .transform((value) => value.replace(/\/+$/, "")),
});

const parsed = siteEnvSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

if (!parsed.success) {
  throw new Error(
    `Invalid site configuration: ${z.prettifyError(parsed.error)}`,
  );
}

export const siteConfig = {
  url: parsed.data.NEXT_PUBLIC_SITE_URL,
  locale: "en_IN",
  timeZone: "Asia/Kolkata",
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${siteConfig.url}/`).toString();
}
