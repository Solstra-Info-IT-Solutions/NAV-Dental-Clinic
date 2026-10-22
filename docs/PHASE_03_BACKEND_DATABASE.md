# Phase 3 — Core Backend and Database

**Status:** Tested (locally, against an in-memory MongoDB replica set; Atlas not yet connected)
**Date:** 2026-10-22

## 1. Objective and business value

Make MongoDB the source of truth for clinic settings and services, and put in place the foundations every later feature relies on: one safe database connection, every collection and index from DATABASE_SCHEMA.md, a consistent error format, a privacy-safe logger, and rate limiting. Most importantly, the double-booking guard (unique slot holds inside transactions) is now proven to work under concurrency before any booking code is written.

## 2. Files created or modified

| Area | Files |
|---|---|
| Config | `src/config/env.server.ts` (lazy, validated server env) |
| Database | `src/lib/db/connection.ts`, `src/lib/db/models/{clinic-settings,service,schedule,appointment,enquiry,operations,index}.ts` |
| Errors/HTTP | `src/lib/errors.ts`, `src/lib/api/http.ts`, `src/lib/validation.ts`, `src/lib/logger.ts` |
| Security | `src/lib/security/rate-limit.ts` |
| Features | `src/features/clinic-settings/{schemas,repository}.ts` (new), `queries.ts` (now reads MongoDB); `src/features/services/repository.ts` (new), `queries.ts` (now reads MongoDB), `catalog.ts` (now seed data); `src/features/audit/service.ts` |
| API | `src/app/api/public/settings/route.ts`, `src/app/api/public/services/route.ts`, `src/app/api/public/services/[slug]/route.ts` |
| Scripts | `scripts/with-db.ts`, `scripts/db-init.ts`, `scripts/lib/database.ts` |
| Tests | `tests/support/mongo.ts`, `tests/integration/database.test.ts`, `tests/integration/settings-and-rate-limit.test.ts`, `tests/unit/server-helpers.test.ts`, `tests/e2e/public-api.spec.ts` |
| Tooling | `package.json` (mongoose 9.11, mongodb-memory-server 11.3, tsx, @next/env; `dev`/`build`/`start` via `with-db`, new `db:init`) |
| Docs | `docs/DATABASE_SCHEMA.md` (status + §14 deviations), `README.md`, this file, `docs/IMPLEMENTATION_STATUS.md` |

## 3. Architecture and decisions

| Decision | Detail |
|---|---|
| **In-memory MongoDB for development** (owner instruction) | `scripts/with-db.ts` wraps `dev`, `build` and `start`. With no `MONGODB_URI`, it starts a single-node **replica set** (so transactions work) on `127.0.0.1:27027` with MongoDB 8.2.6, runs the same initialisation as `db:init`, and passes the URI to Next. A second wrapper reuses an already running one. When `MONGODB_URI` is set (env or `.env.local`), it runs against that database unchanged. **It refuses to start an in-memory DB in production.** Data is temporary and is lost when the process stops. |
| One cached connection | `connectToDatabase()` caches the connection promise on `globalThis` (survives hot reload and serverless warm starts), clears it on failure so the next request retries, `bufferCommands: false` so outages fail fast as `503`. |
| Global query safety | `sanitizeFilter: true` and `strictQuery: "throw"`. `autoIndex: false`: indexes are built only by `db:init`/`syncIndexes()`. |
| Plain objects across the cache boundary | Repositories use `.lean()` and map to plain types (`toPublicSettings`, `toServiceContent`). Nothing Mongoose-specific reaches `"use cache"` results or Client Components. |
| Settings fallback | If the settings document is missing (DB not initialised), pages use the verified defaults and log `settings.not_initialised` rather than failing. A missing `MONGODB_URI` is still a hard error. |
| Optimistic concurrency for settings | `updateSettings({ expectedVersion })` validates the **merged** document with Zod, updates only if the version matches (`$inc` version), and writes an audit entry with contact fields masked as `[changed]`. Used by the admin UI in Phase 6. |
| Error envelope | `AppError(code)` → `{ error: { code, message, fields?, requestId } }` with the statuses from API_DOCUMENTATION.md. Unknown errors become `INTERNAL` (logged with requestId, never echoed); driver outages become `SERVICE_UNAVAILABLE`. |
| Request helpers | `readJson()` enforces `application/json`, the 16 KB limit on actual bytes, JSON validity and the Zod schema. `assertSameOrigin()` enforces `Sec-Fetch-Site`/`Origin` for mutations. Both are ready for Phase 4/5 handlers. |
| Rate limiting | Fixed-window counters in `rate_limits` (atomic upsert + `$inc`, TTL cleanup). Identifiers are salted SHA-256 hashes. The upsert race on the first request in a window is retried once. All documented limits are defined in `RATE_LIMITS`. |
| Audit log | `audit_logs` is append-only at the model level (update/delete middleware throws). |
| Logger | JSON lines; recursively redacts `phone`, `email`, `password`, `token`, `cookie`, `authorization`, `message`, `uri` keys; `maskPhone`/`maskEmail` helpers. |

## 4. Data flows

- **Page render:** `getPublicSettings()` (`"use cache"`, tag `clinic-settings`, 1 h) → `connectToDatabase()` → `findSettings()` → `toPublicSettings()`. Services follow the same pattern with tag `services`. Pages are still prerendered at build time and refreshed by cache tags/ISR.
- **Public API:** `GET /api/public/settings|services|services/{slug}` reuse the same cached queries; errors use the shared envelope with `Cache-Control: no-store`.
- **Initialisation:** `initialiseDatabase()` → create missing collections → `syncIndexes()` per model → `seedSettings()` (`$setOnInsert`) → `seedServices()` (bulk `$setOnInsert` by slug).

## 5. Checks executed

| Command | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ 6 files, **52 tests passed** (23 unit from Phase 2 + 29 new) |
| `npm run build` | ✅ in-memory DB started and seeded (10 collections, 13 services); 15 routes; public pages static |
| `npx playwright test` | ✅ **71 passed**, 9 skipped by design (device-specific tests) |
| `npm run db:init` without `MONGODB_URI` | ✅ fails with a clear message (exit 1) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |

Key new tests:
- **Concurrency:** 8 simultaneous transactions inserting the same slot hold → exactly 1 commits, 7 get a duplicate-key conflict, and 1 hold exists.
- Every documented unique, partial and TTL index exists after initialisation.
- Seeding is idempotent and never overwrites edited settings or services.
- Settings: version conflict → `VERSION_CONFLICT`; overlapping hours → `VALIDATION_FAILED` with field path; audit entries mask contact fields; public settings never include staff emails or internals.
- Rate limiter: limit, window reset, independent identifiers, 10 concurrent first requests → exactly 3 allowed, only hashes stored.
- HTTP helpers: 415/413/400/422 handling, cross-origin rejection, error envelope never leaks internals, `Retry-After`.
- E2E: public APIs return database data, hide internal fields, 404 envelope for unpublished services, 405 on writes, `X-Robots-Tag: noindex` on `/api`.

## 6. Known issues / limitations

- Not yet tested against **MongoDB Atlas**. Once you provide a URI: put it in `.env.local`, run `npm run db:init`, then `npm run build && npm run start`.
- In-memory development data disappears when `npm run dev` stops (by design). Test appointments made in Phase 4 will not persist between dev sessions.
- `npm run build` locally starts its own in-memory DB; the page data baked into the build comes from the seed, which matches what `npm run start` seeds.
- Because `dev`, `build` and `start` run through `tsx`, `tsx` must be installed (it is a devDependency; Vercel installs devDependencies during builds).
- Dev-only `npm audit` advisories in ESLint tooling remain (see PHASE_02 §6).

## 7. Completion checklist

- [x] MongoDB connection management
- [x] All 10 models with validation and indexes
- [x] Initialisation and seed script (`db:init`), idempotent
- [x] Settings and services served from MongoDB (pages and public API)
- [x] Centralised error handling and response envelope
- [x] Structured, redacting logger
- [x] MongoDB-backed rate limiter
- [x] Audit log service (append-only)
- [x] Integration tests on a real replica set, including the concurrency guarantee
- [ ] Atlas connection verified (waiting for URI)

## 8. External inputs required

- **MongoDB Atlas connection string** (Mumbai `ap-south-1` recommended) with a database user limited to `readWrite` on one database.
- `RATE_LIMIT_SALT` for production (any long random string).
