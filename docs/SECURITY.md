# Security and Privacy

**Status:** Final for the build (Phase 8, 2026-10-24). Controls below are implemented and tested unless marked otherwise. Production-only items (HTTPS, HSTS, real secrets) are verified at deployment (Phase 10). Nothing here claims compliance with any law or certification.

## 1. Assets and data classification

| Data | Class | Where |
|---|---|---|
| Patient name, mobile, optional email, appointment time, service | **Confidential (personal data)** | `appointments` |
| Patient free-text message (≤ 500 chars, UI warns against medical detail) | Confidential | `appointments.message` |
| Enquiries (name, mobile, optional email, message) | Confidential | `enquiries` |
| Staff accounts, password hashes, sessions | Secret | Better Auth `user`, `account`, `session` |
| Secrets (DB URI, auth secret, rate-limit salt, email key, cron secret) | Secret | Environment variables only |
| Clinic settings, services | Public / internal | `clinic_settings`, `services` |

## 2. Trust boundaries

1. Browser → public pages and `/api/public/*`: untrusted input.
2. Browser → `/admin` and `/api/admin/*`: authenticated, re-authorised on every request.
3. App → MongoDB Atlas: TLS; a database user with `readWrite` on one database.
4. App → Resend: HTTPS with an API key from env.
5. Vercel Cron → `/api/cron/notifications`: Bearer `CRON_SECRET` (constant-time compare).

## 3. Threats, controls and evidence

| Threat | Control | Evidence (automated) |
|---|---|---|
| Double booking / race | Unique `{resourceKey,start}` slot holds written in the same transaction as the appointment | 10 concurrent requests → 1 booking (integration); 2 concurrent HTTP requests → 201 + 409 (E2E) |
| Duplicate submission | Idempotency key (unique partial index), kept on retry | Integration + E2E |
| Booking enumeration | 50-bit CSPRNG references; lookup needs reference **and** phone; identical 404s; constant-time compare; 10 per 10 min | Unit, integration, E2E (429) |
| Spam / abuse | Honeypot, minimum 3 s fill time, max 24 h age, per-IP and per-phone limits, content scoring for enquiries, 16 KB body limit | Unit, integration, E2E |
| Credential stuffing | Better Auth limiter on the shared MongoDB store (5 sign-ins / 15 min / IP); generic errors; failures audited | Integration + E2E |
| Broken access control | `adminRoute(role)` on every admin API; `requireAdminPage(role)` on every admin page; roles owner/staff; disabled users have no sessions | **Route-enumeration E2E:** every admin method → 401 anonymous, 403 staff on owner-only |
| CSRF | `SameSite=Lax` cookies, same-origin (`Origin`/`Sec-Fetch-Site`) check on every mutation, Better Auth origin check | Unit + E2E (cross-site → 403) |
| XSS | React escaping; no user HTML stored; the only `dangerouslySetInnerHTML` is JSON-LD built from typed objects with `<`, U+2028/2029 escaped; CSP (see §4) | Unit (escaping) + E2E (no CSP violations) |
| NoSQL injection | Every user value is parsed by Zod into a primitive before reaching a query; `strictQuery: "throw"`; search input regex-escaped and length-capped | Unit + E2E (`{ "$ne": "" }` → 422) |
| CSV / formula injection | Exports prefix `= + - @ \t \r` cells with `'`; all cells quoted | Unit + integration |
| Sensitive data in logs | JSON logger redacts phone, email, password, token, cookie, authorization, message, uri keys; phones masked; IPs only as salted SHA-256 | Unit |
| Secrets in the browser | Server env parsed only in `server-only` modules; only `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (and an unused Turnstile site key) are public | **E2E scans `.next/static/**/*.js`** for secret names, Mongo URIs, Mongoose, auth adapters: none |
| Secrets in the repository | `.env*` ignored (except `.env.example` with placeholders); test-only credentials are labelled and valid only for the throwaway in-memory database | Phase 8 `git grep` secret-pattern scan: clean |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | E2E |
| Private pages in search | `noindex` meta + `X-Robots-Tag` on `/admin`, `/api`; robots disallow; non-production builds `noindex` everywhere | E2E |
| Caching of private data | All admin and patient-specific API responses `Cache-Control: no-store`; admin pages render per request | E2E |
| Email failure hides a booking | Booking committed first; attempts recorded and retried; dashboard warning | Integration |
| Data kept too long | `npm run db:purge` (dry run by default) deletes appointments/enquiries older than the owner-set retention; spam auto-deleted after 30 days (TTL) | Integration |
| Vulnerable dependencies | Minimal dependency set; lockfile committed | `npm audit` (all deps): **0 vulnerabilities** (2026-10-24) |

## 4. HTTP headers (implemented in `src/lib/security/headers.ts`)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; worker-src 'self' blob:;
  manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  [; upgrade-insecure-requests when the site URL is HTTPS]
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains   (HTTPS deployments only; no `preload` until the clinic confirms)
X-Robots-Tag: noindex, nofollow   (/admin, /api; and every path on non-production builds)
```
`X-Powered-By` is removed. Development builds add `'unsafe-eval'` and `ws:` (needed by React dev tooling only).

**Accepted risk: `script-src 'unsafe-inline'`.** Next.js 16 streams page data as inline scripts. Phase 8 tested the alternatives:
- A **nonce** CSP forces every page to render dynamically and is documented as incompatible with Partial Prerendering. It would give up the static, CDN-cached public site.
- A strict `script-src 'self'` with experimental SRI blocked 29 inline Next.js scripts on the booking page, which broke the site.

Mitigations:
- no third-party scripts at all;
- no `eval` in production (Zod runs in `jitless` mode, verified in DevTools with no CSP issues);
- React output escaping;
- no stored user HTML;
- strict `connect-src`, `form-action`, `base-uri`, `object-src`, `frame-src` and `frame-ancestors`, which limits what injected script could do or send.

Revisit if Next.js adds nonce support for prerendered pages.

## 5. Authentication

- Better Auth email/password; scrypt password hashes; 12–128 characters; **no public sign-up** (tested).
- First owner via `npm run admin:create` (hidden prompt or one-time generated password). Further accounts are created by an owner with a one-time temporary password. No default or hardcoded production passwords exist.
- Sessions: 8 h, refreshed hourly, cookie prefix `nav.`, `HttpOnly`, `SameSite=Lax`, `Secure` in production. Disabled accounts can't create sessions; disabling, demoting or resetting a password revokes all sessions. The last active owner can't be removed.
- Trusted origins: the canonical URL plus the request's own origin (blocks cross-site requests while allowing previews).
- **Not yet:** email-based password reset (needs email); TOTP two-factor for owners (recommended; client decision).

## 6. Privacy by design

- Only the booking and enquiry fields from the brief are collected; no date of birth, address or medical history.
- Privacy acknowledgement is required; marketing opt-in is separate, optional, off by default, and stored with the policy version.
- Lists mask phone numbers; full details only on the record page; exports owner-only, ≤ 92 days, audited.
- Audit log is append-only and never copies contact details or note text.
- Retention: owner sets periods in Clinic settings (proposed 24 months for appointments, 12 for enquiries). Run `npm run db:purge -- --apply` on a schedule once the clinic confirms (manual or a scheduled job at deployment).
- Hosting in India (Atlas `ap-south-1`, Vercel `bom1`) where available.
- The clinic should review its obligations under India's Digital Personal Data Protection Act, 2023 and its rules with a qualified advisor. The Privacy Policy draft supports that review; it does not assert compliance.

## 7. Operational security (for deployment)

- Generate unique long random values for `BETTER_AUTH_SECRET`, `RATE_LIMIT_SALT`, `CRON_SECRET`; store them only in the hosting provider's environment settings.
- Atlas: a dedicated database user (`readWrite` on one database), IP access list or private networking, backups enabled.
- Rate limits trust the first `X-Forwarded-For` value. Vercel sets it; a self-hosted deployment must sit behind a proxy that overwrites it.
- Rotate secrets after staff changes; sign out all sessions via password reset or disable.

## 8. Incident basics

1. Rotate the affected secret in the hosting settings and redeploy (rotating `BETTER_AUTH_SECRET` signs everyone out).
2. Disable compromised staff accounts in *Staff accounts*.
3. Use the audit log (*Audit log* screen) to establish what was accessed or changed.
4. Restore data from Atlas backups if needed.
5. Assess notification duties with the clinic's advisor.
