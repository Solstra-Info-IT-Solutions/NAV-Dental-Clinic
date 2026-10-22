# Architecture — NAV Dental Clinic Website

**Status:** Approved (Phase 1, 2026-10-22). Detailed contracts: DATABASE_SCHEMA.md, API_DOCUMENTATION.md, SECURITY.md. Decisions log: PHASE_01_ARCHITECTURE_DESIGN.md §3.

## 1. Stack (no deviations from the master prompt)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript `strict` | Required. Server Components by default; Route Handlers + Server Actions. |
| Styling | Tailwind CSS v4 with tokens in `@theme` | Required. CSS-first tokens = one source of truth (DESIGN_SYSTEM.md). |
| Validation | Zod 4 schemas shared by client and server | One schema per input. Server always re-parses. |
| Forms | React Hook Form + `@hookform/resolvers/zod` | Required. Used only in client form components. |
| Database | MongoDB Atlas + Mongoose 9 | Required. Multi-document **transactions** (Atlas replica set) are used for slot reservations. |
| Auth | **Better Auth** (email + password, DB sessions in MongoDB, built-in rate limiting) | Maintained, first-class Next.js App Router and MongoDB adapter, server-side `auth.api.getSession()`, secure cookies, password hashing (scrypt) built in. `next-auth` latest stable is still v4, and the v5 line was not a stable release, so it was not chosen. |
| Email | Resend (behind an `EmailProvider` interface) | Required/default; swappable. |
| Icons | lucide-react | Required. |
| Tests | Vitest + React Testing Library; Playwright; `mongodb-memory-server` replica set | Real-database integration tests for the concurrency guarantees. |
| Hosting | Vercel (functions in `bom1` Mumbai) + Atlas `ap-south-1` | Data and latency in India. |

**Not added:** UI kits, animation libraries, state managers, date-picker libraries (native `<input type="date">` + server-provided slots), Redis. Each would add weight without a requirement that justifies it.

Dates use the platform `Intl` APIs plus a small typed helper module for IST (fixed UTC+05:30, no DST). We will add `date-fns` + `@date-fns/tz` only if the helpers grow beyond simple, tested functions.

### Next.js 16 notes

- `middleware.ts` is now `proxy.ts`. We use it **only** for cheap redirects (unauthenticated `/admin/*` → `/admin/login`) and security headers. It is **never** the authorization boundary: every admin layout, Server Action and Route Handler re-checks the session on the server.
- Public pages are statically rendered/ISR and revalidated by tag when admin settings change (`revalidateTag('clinic-settings')`). Anything with patient data is `dynamic` and sends `Cache-Control: no-store`.

## 2. Folder structure

```
src/
  app/
    (public)/            layout with Header/Footer
      page.tsx           home
      about/ services/ services/[slug]/ appointment/ appointment/status/
      contact/ faq/ privacy-policy/ terms/
    admin/
      login/
      (protected)/       layout calls requireAdmin()
        page.tsx         dashboard
        appointments/ appointments/[id]/ enquiries/ schedule/ services/ settings/ audit/
    api/
      public/            services, settings, slots, appointments, appointments/status, enquiries
      admin/             appointments, enquiries, schedule, services, settings, notifications
      auth/[...all]/     Better Auth handler
    sitemap.ts robots.ts manifest.ts layout.tsx error.tsx global-error.tsx not-found.tsx
  components/  layout/ home/ services/ appointments/ contact/ forms/ admin/ ui/
  features/                       business logic, framework-agnostic
    appointments/  (service.ts, slots.ts, status-machine.ts, reference.ts, schemas.ts)
    enquiries/ services/ clinic-settings/ notifications/ audit/
  lib/  db/ (connection, models)  auth/  security/ (rate-limit, spam, headers)  email/  seo/  time/  errors/  logger/
  config/  site.ts (env-derived, validated with Zod at boot)
  i18n/    dictionaries/en.ts (hi.ts later), getDictionary()
  styles/  tokens.css globals.css
tests/  unit/ integration/ e2e/
scripts/ seed-admin.ts  init-db.ts (indexes + default settings)  retry-notifications.ts
docs/
```

Rule: `app/` (routes) → `features/*` (services, the only place with business rules) → `lib/db` (models). Route Handlers and Server Actions are thin: authenticate → parse with Zod → call a feature service → map result to HTTP. Anything under `features/` and `lib/db` imports `server-only`.

## 3. Data model (detail in DATABASE_SCHEMA.md, Phase 3)

| Collection | Key fields | Key indexes |
|---|---|---|
| `clinic_settings` (singleton) | names, phone, address, weekly hours, breaks, slotMinutes, capacity, minNoticeMinutes, maxAdvanceDays, bookingMode, whatsappEnabled, notification recipients, SEO, social, map | `_id: "default"` |
| `services` | slug, title, summary, body sections, FAQs, published, order | unique `slug`; `{published, order}` |
| `closures` | date range, reason, allDay or time range | `{start, end}` |
| `slot_holds` | resourceKey, start (UTC), holderType (`appointment`/`block`), holderId | **unique `{resourceKey, start}`** |
| `appointments` | reference, patient {name, phoneE164, email?}, serviceId, start, end, status, message, consent flags, idempotencyKey, source (`web`/`admin`), internalNotes, history[] | unique `reference`; unique sparse `idempotencyKey`; `{start, status}`; `{status, createdAt}`; `{patient.phoneE164}` |
| `enquiries` | name, phone, email?, category, message, status, spamScore, idempotencyKey | `{status, createdAt}`; unique sparse `idempotencyKey`; TTL on spam |
| `notification_attempts` | kind, channel, target ref, recipient (masked), status (`sent`/`failed`/`skipped_not_configured`), providerId, error, attempts, nextRetryAt | `{status, nextRetryAt}` |
| `audit_logs` | actorId, action, entity, entityId, before/after (minimised), ip hash, at | `{entity, entityId, at}`; `{at}` |
| `rate_limits` | key (hashed), window, count, expiresAt | unique `{key, window}`; **TTL** on `expiresAt` |
| Better Auth: `user`, `session`, `account`, `verification` | role (`owner`/`staff`) | managed by Better Auth |

## 4. Booking consistency model

**Goal:** two patients can never hold the same slot, and a double-click or retry never creates two bookings.

1. **Slot grid.** Slots are generated server-side from settings (`weekly hours − breaks − closures`, stepped by `slotMinutes`, `>= now + minNotice`, `<= today + maxAdvance`). All instants are stored in **UTC** and rendered in **Asia/Kolkata**.
2. **Holds, not just bookings.** Each occupied grid slot is a `slot_holds` document with a **unique index on `{resourceKey, start}`**. Both patient appointments and admin manual blocks insert holds, so there is one mechanism for both.
3. **Creation transaction** (`session.withTransaction`):
   1. Re-validate the requested start against the *current* settings and closures (the client's slot list is never trusted).
   2. Insert the hold(s) for every grid slot the appointment covers.
   3. Insert the appointment (`status: pending` in request mode).
   4. Commit. A duplicate-key error on step 2 → **`409 SLOT_UNAVAILABLE`** with fresh alternative slots. The loser's transaction aborts, so it leaves no orphan.
4. **Idempotency.** The form generates a UUID `idempotencyKey` per form session. A unique sparse index makes a retry return the **original** reference (`200`, `replayed: true`) instead of a second booking or a false conflict.
5. **Release rule (explicit):** statuses `cancelled`, `rejected` and `no_show` (after the fact) **release** holds in the same transaction as the status change. `pending`, `confirmed`, `reschedule_requested` and `completed` keep them. Rescheduling = insert new holds + delete old holds + update the appointment, in one transaction.
6. **Known limitation:** date-range **closures** are rules, not holds. If an admin adds a closure while a booking for that day is being submitted, the booking may succeed. Mitigation: creating a closure lists affected active appointments and asks the admin to reschedule/cancel them; the scenario is rare, visible, and recoverable.
7. **Capacity > 1** (more chairs later): `resourceKey` becomes `chair-1..n`, and the service tries keys in order. No schema change needed.

## 5. Status machine

```
pending ──confirm──▶ confirmed ──complete──▶ completed
   │                    │  │
   │reject              │  └─no-show──▶ no_show
   ▼                    ▼
rejected            reschedule_requested ──reschedule──▶ confirmed
   (any non-terminal) ──cancel──▶ cancelled
```
Terminal: `completed`, `cancelled`, `rejected`, `no_show`. Transitions are a typed table in `features/appointments/status-machine.ts`. Every transition writes `history[]` and an `audit_logs` entry, and may enqueue a notification.

## 6. Notifications

`notify()` runs **after** the booking transaction commits and never throws into the booking path. Each send writes a `notification_attempts` row (`sent` / `failed` / `skipped_not_configured`). Failed rows get exponential `nextRetryAt`. They are retried from admin ("Retry") and by a Vercel Cron route `/api/cron/notifications` protected by `CRON_SECRET`. The patient success screen never says "email sent" unless the attempt actually succeeded.

## 7. Security boundaries

| Boundary | Control |
|---|---|
| Public → API | Zod parse, body size limit (16 KB), same-origin check on mutating requests (`Origin`/`Sec-Fetch-Site`), rate limit per IP-hash + per phone, honeypot + minimum fill time, optional Cloudflare Turnstile (enabled when keys exist) |
| Public → booking data | Status lookup needs **reference + mobile number**, returns minimal fields (service, date/time, status), constant-shape `404` for any mismatch, strict rate limit. References are 10-character random Crockford Base32 (`NAV-XXXX-XXXX-XX`, ~50 bits), not sequential. |
| Admin | Better Auth session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, `__Secure-` prefix in prod); `requireAdmin(role?)` in every protected layout, action and handler; login rate limiting; no public sign-up (admins created by `scripts/seed-admin.ts` / by owner). |
| Headers | CSP with nonces, HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'`; `X-Robots-Tag: noindex` on `/admin` and `/api` |
| Data | No medical history; PII never logged (phones masked `+91******6001`); IP addresses stored only as salted hashes; retention purge script |
| Secrets | Only in env vars; `src/config` validates them at boot; `server-only` guards; nothing secret prefixed `NEXT_PUBLIC_` |

## 8. SEO architecture

`lib/seo` builds metadata and JSON-LD **only from `clinic_settings` and published services**. Absent fields are omitted, never defaulted. Canonical host comes from `NEXT_PUBLIC_SITE_URL`. Any deployment whose host ≠ canonical host serves `noindex`. The sitemap lists only published public routes.

## 9. i18n readiness

All UI copy lives in `src/i18n/dictionaries/en.ts`, typed. Routes stay unprefixed for English. Hindi can later be added as `/hi/...` with `hreflang` alternates without restructuring components.

## 10. Environment variables (full list in DEPLOYMENT.md, Phase 10)

`MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `CLINIC_ALERT_EMAILS`, `CRON_SECRET`, `RATE_LIMIT_SALT`, optional `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`, `GOOGLE_SITE_VERIFICATION`.
