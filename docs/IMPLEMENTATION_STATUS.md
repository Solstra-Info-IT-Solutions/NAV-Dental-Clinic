# Implementation Status

_Last updated: 2026-10-24 (end of Phase 7)_

## Phase status

| Phase | Status |
|---|---|
| 0 Discovery | Implemented (documentation) |
| 1 Architecture & design system | Implemented (documentation and contracts) |
| 2 Setup & public UI | Tested (local production build) |
| 3 Backend & database | **Tested** (in-memory MongoDB replica set; Atlas pending) |
| 4 Appointment booking | **Tested** (in-memory DB with sample hours; email delivery not verified) |
| 5 Contact & enquiries | **Tested** (in-memory DB; staff email delivery not verified) |
| 6 Admin dashboard | **Tested** (in-memory DB; not deployed; no 2FA / email password reset yet) |
| 7 SEO & content | **Tested** (local build; live validation after deployment) |
| 8 Quality & security | Not Started |
| 9 Testing | Not Started |
| 10 Deployment & handover | Not Started |

## Implemented features

- Public website (Phase 2), now reading clinic settings and services from MongoDB
- MongoDB layer: connection management, 10 models with indexes, idempotent `db:init` seed
- Public read APIs: settings, services, service detail
- Error envelope, request helpers (size limit, JSON, same-origin), redacting logger
- MongoDB-backed rate limiter; append-only audit log; optimistic-concurrency settings updates
- Automatic in-memory MongoDB for `dev`/`build`/`start` when `MONGODB_URI` is not set (with sample opening hours and a visible "sample data" banner)
- Online appointment requests: live dates/slots, booking form, transactional slot holds (no double booking), idempotent submissions, booking references, status lookup page
- Appointment status machine, cancellation slot release and atomic rescheduling (services ready for the admin dashboard)
- Notification recording with retry/backoff and a protected cron endpoint (email provider not yet configured)
- Contact form with layered spam protection, rate limits, idempotent submissions, staff alerts and enquiry status management
- SEO: per-page metadata with canonical/OG/Twitter, owner-editable home SEO, share image, robots.txt and sitemap.xml, noindex outside production, canonical-host redirect, JSON-LD (Dentist, WebSite, BreadcrumbList, Service, FAQPage) from verified data, renamed-service redirects
- Secure admin dashboard (Better Auth, owner/staff roles enforced server-side): dashboard, appointments (search/filter/detail/confirm/reject/cancel/reschedule/complete/no-show/notes/manual booking/export), schedule (blocks, closures), enquiries, notification retry, services, clinic settings incl. opening hours, staff accounts, audit log

## Files changed

- Phase 0–1: `e903721` · Phase 2: `9e17002` · Phase 3: `88a6496` · Phase 4: `591ead7` · Phase 5: `a2eb3f3` · Phase 6: `6e44695` · Phase 7: see `docs/PHASE_07_SEO_CONTENT.md` §2

## Tests executed (latest run)

| Command | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run test` | 148/148 passed (unit + integration on a real replica set) |
| `npm run build` | Pass |
| `npx playwright test` | 106 passed, 30 skipped by design (incl. admin route-enumeration auth test, axe scans, SEO checks) |
| `npm audit --omit=dev` | 0 vulnerabilities |

## Known issues

- Atlas not yet connected or verified.
- Email delivery not verified (no Resend account/domain yet); therefore no email-based password reset.
- No two-factor authentication for admin accounts yet (client decision).
- Dev-only `npm audit` advisories in lint tooling.
- C: drive almost full; npm cache and Playwright browsers live on D:.
- Logo is a provisional trace; copy and legal pages are drafts awaiting approval.

## Outstanding client inputs

See PHASE_00_DISCOVERY.md §3, plus: MongoDB Atlas URI, Resend account + verified domain, staff alert email(s), `CRON_SECRET`, `BETTER_AUTH_SECRET`, the list of staff who need accounts (and who is owner), and a 2FA decision. Highest impact: **real opening hours** (online booking stays closed on a real database without them; development and tests use sample hours only).

## Next recommended step

Phase 8: security, accessibility and performance. That means a nonce-based Content-Security-Policy via proxy, HSTS (production), a security review of all inputs and routes, Turnstile decision, Lighthouse measurements (mobile) with fixes, font and image optimisation review, keyboard and screen-reader pass, secret scanning, dependency audit, and the final SECURITY.md.
