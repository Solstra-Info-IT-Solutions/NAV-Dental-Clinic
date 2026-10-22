# Implementation Status

_Last updated: 2026-10-22 (end of Phase 3)_

## Phase status

| Phase | Status |
|---|---|
| 0 Discovery | Implemented (documentation) |
| 1 Architecture & design system | Implemented (documentation and contracts) |
| 2 Setup & public UI | Tested (local production build) |
| 3 Backend & database | **Tested** (in-memory MongoDB replica set; Atlas pending) |
| 4 Appointment booking | Not Started |
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
- Automatic in-memory MongoDB for `dev`/`build`/`start` when `MONGODB_URI` is not set

## Files changed

- Phase 0–1: commit `e903721` · Phase 2: commit `9e17002` · Phase 3: see `docs/PHASE_03_BACKEND_DATABASE.md` §2

## Tests executed (latest run)

| Command | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run test` | 52/52 passed (unit + integration on a real replica set) |
| `npm run build` | Pass (in-memory DB, 15 routes) |
| `npx playwright test` | 71 passed, 9 skipped by design |
| `npm audit --omit=dev` | 0 vulnerabilities |

## Known issues

- Atlas not yet connected or verified.
- Dev-only `npm audit` advisories in lint tooling.
- C: drive almost full; npm cache and Playwright browsers live on D:.
- Logo is a provisional trace; copy and legal pages are drafts awaiting approval.

## Outstanding client inputs

See PHASE_00_DISCOVERY.md §3, plus: MongoDB Atlas URI. Highest impact for Phase 4: **opening hours** (online booking stays closed without them; development and tests use sample hours).

## Next recommended step

Phase 4: appointment booking. That means the IST slot engine, available-dates/slots APIs, the booking form, the hold+appointment transaction, idempotency, references, the status machine, status lookup, and notification recording with retry. Email delivery waits for Resend credentials.
