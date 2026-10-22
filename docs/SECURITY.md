# Security and Privacy (Draft)

**Status:** Draft from Phase 1. Controls are verified and this document is finalised in Phase 8. Nothing here claims compliance with any law or certification.

## 1. Assets and data classification

| Data | Class | Where |
|---|---|---|
| Patient name, mobile, optional email, appointment time, service | **Confidential (personal data)** | `appointments` |
| Patient free-text message | Confidential; may contain health hints, so it is minimised (≤ 500 chars, with a UI warning) | `appointments.message` |
| Enquiry contents | Confidential | `enquiries` |
| Admin credentials and sessions | Secret | Better Auth collections (hashed passwords, hashed session tokens) |
| API keys (DB, Resend, Turnstile, cron, auth secret) | Secret | Environment variables only |
| Clinic settings, services | Public / internal | `clinic_settings`, `services` |

## 2. Trust boundaries

1. **Browser → public API:** fully untrusted input.
2. **Browser → admin UI/API:** authenticated, but every request is re-authorised server-side.
3. **App → MongoDB Atlas:** TLS, a database user with least privilege (`readWrite` on one database only), IP access list / Vercel integration.
4. **App → Resend / Turnstile:** outbound HTTPS with secrets from env.
5. **Vercel Cron → `/api/cron/*`:** bearer secret.

## 3. Threats and controls

| Threat | Control | Verified by (Phase 8/9) |
|---|---|---|
| Double booking / race | Unique `{resourceKey,start}` holds inside transactions | Parallel-request integration test |
| Duplicate submission | Idempotency key with a unique partial index | Integration test |
| Booking enumeration | Random 50-bit references; status lookup needs reference **and** phone; identical 404s; 10/10 min rate limit | Unit + integration tests |
| Spam / abuse of forms | Honeypot, minimum fill time, per-IP and per-phone limits, optional Turnstile, payload limit | Integration tests |
| Credential stuffing | Better Auth rate limit + our IP/email limits; generic "invalid email or password"; audit of failures | e2e test |
| Broken access control | `requireAdmin()` in every protected layout, Server Action and Route Handler; role checks; a test that **enumerates every `/api/admin/*` route** and asserts 401 without a session | Automated |
| CSRF | `SameSite=Lax` cookies + same-origin check on all mutations + Better Auth's origin check; Server Actions have built-in origin checks | Integration test with a foreign `Origin` |
| XSS | React escaping; **no `dangerouslySetInnerHTML`** except JSON-LD serialised with `<` escaped; services stored as plain text; nonce-based CSP | Lint rule + CSP test |
| NoSQL injection | Zod parses every user value to a primitive before it reaches a query; `strictQuery: "throw"`; regex search input escaped and length-capped. (Mongoose's global `sanitizeFilter` is not used: it also disables the app's own trusted `$gte`/`$lt` queries — found in Phase 4.) | Schema unit tests; integration tests |
| Spoofed client IP for rate limits | Rate limits key on the first `X-Forwarded-For` value. Vercel documents that it overwrites this header with the real client IP (re-verify against current Vercel docs in Phase 10); a self-hosted deployment must sit behind a proxy that does the same. | Deployment checklist (Phase 10) |
| CSV injection | Export cells prefixed with `'` when they start with `= + - @` | Unit test |
| Sensitive data in logs | Structured logger with a redaction list (`phone`, `email`, `password`, `token`, `cookie`, `authorization`); phones masked; IPs salted-hashed | Unit test on the logger |
| Secret leakage | Only `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` are public; `server-only` imports; env validated at boot; `.env*` git-ignored; secret scan (gitleaks) before release | Build-output grep + gitleaks |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Header test |
| Admin indexed by search engines | `noindex` meta + `X-Robots-Tag` on `/admin` and `/api`; excluded from sitemap; disallowed in robots (defence in depth, not a security control) | SEO test |
| Dependency vulnerabilities | `npm audit --omit=dev` gate; minimal dependency set; lockfile committed | CI step |
| Notification failure hides a booking | Booking committed first; attempts recorded; staff dashboard shows the failed count | Integration test with a failing provider stub |

## 4. Headers (set in `next.config.ts` / `proxy.ts`)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic' https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';
  connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com https://www.google.com;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload   (production only, after the domain is confirmed)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-Frame-Options: DENY
```
`style-src 'unsafe-inline'` is required for Next.js/Tailwind runtime style attributes. This is documented as an accepted risk. `frame-src https://www.google.com` is present only if the clinic approves an embedded Google Map. Otherwise a static "Get directions" link is used, and the map is loaded only after the visitor clicks it (no third-party request on page load).

## 5. Authentication details

- Better Auth email/password; passwords hashed by Better Auth (scrypt); minimum 12 characters; maximum 128.
- Public sign-up disabled. The first owner is created with `npm run admin:create`, which prompts interactively. No default or hardcoded passwords exist anywhere.
- Sessions: database-backed, 8 h with sliding refresh, revoked on password change; "sign out all sessions" available to the owner.
- Password reset only once transactional email is configured and verified.
- Optional TOTP two-factor (Better Auth plugin) recommended for the owner. Decision deferred to Phase 6.

## 6. Privacy by design

- Collect only the booking fields in the brief. No date of birth, address or medical history.
- Privacy acknowledgement is required; marketing opt-in is separate and defaults to off.
- The privacy notice version is stored with each consent.
- Retention purge script with clinic-approved periods (proposed 24 / 12 months), not enabled until approved.
- Data hosted in India (Atlas `ap-south-1`, Vercel `bom1`) where available on the chosen plans.
- The clinic should review its obligations under India's Digital Personal Data Protection Act, 2023 and applicable rules with a qualified advisor. The Privacy Policy draft is written to support that review, **not** to assert compliance.

## 7. Incident basics (expanded in Phase 10)

Rotate secrets via Vercel env vars and redeploy. Revoke all sessions. Atlas point-in-time restore (tier-dependent). Audit log query for scope.
