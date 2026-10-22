# Implementation Status

_Last updated: 2026-10-22 (end of Phase 4)_

## Phase status

| Phase | Status |
|---|---|
| 0 Discovery | Implemented (documentation) |
| 1 Architecture & design system | Implemented (documentation and contracts) |
| 2 Setup & public UI | Tested (local production build) |
| 3 Backend & database | **Tested** (in-memory MongoDB replica set; Atlas pending) |
| 4 Appointment booking | **Tested** (in-memory DB with sample hours; email delivery not verified) |
| 5 Contact & enquiries | Not Started |
| 6 Admin dashboard | Not Started |
| 7 SEO & content | Not Started |
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

## Files changed

- Phase 0–1: `e903721` · Phase 2: `9e17002` · Phase 3: `88a6496` · Phase 4: see `docs/PHASE_04_APPOINTMENT_BOOKING.md` §2

## Tests executed (latest run)

| Command | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run test` | 105/105 passed (unit + integration on a real replica set) |
| `npm run build` | Pass |
| `npx playwright test` | 80 passed, 14 skipped by design |
| `npm audit --omit=dev` | 0 vulnerabilities |

## Known issues

- Atlas not yet connected or verified.
- Email delivery not verified (no Resend account/domain yet).
- Dev-only `npm audit` advisories in lint tooling.
- C: drive almost full; npm cache and Playwright browsers live on D:.
- Logo is a provisional trace; copy and legal pages are drafts awaiting approval.

## Outstanding client inputs

See PHASE_00_DISCOVERY.md §3, plus: MongoDB Atlas URI, Resend account + verified domain, staff alert email(s), `CRON_SECRET`. Highest impact: **real opening hours** (online booking stays closed on a real database without them; development and tests use sample hours only).

## Next recommended step

Phase 5: contact form and enquiries (persistence, spam protection, rate limits, staff alert, statuses). It reuses the Phase 3–4 request, spam, rate-limit and notification foundations.
