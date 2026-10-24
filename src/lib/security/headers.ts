/**
 * HTTP security headers, shared by next.config.ts (no path aliases here).
 *
 * Content-Security-Policy trade-off (documented in docs/SECURITY.md §4):
 * Next.js streams page data as inline <script> tags. A nonce-based CSP would
 * force every page to render dynamically and is incompatible with Partial
 * Prerendering; a strict `script-src 'self'` blocks those inline scripts and
 * breaks the site (verified in Phase 8). We therefore allow inline scripts but
 * no eval in production, no third-party scripts, and lock down everything else.
 */
export type HeaderOptions = { https: boolean; development: boolean };

export function contentSecurityPolicy({ https, development }: HeaderOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(development ? ["ws:"] : [])],
    "frame-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Two years; `preload` is deliberately not set until the clinic confirms all subdomains are HTTPS.
    ...(options.https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}
