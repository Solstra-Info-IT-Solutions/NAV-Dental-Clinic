# Phase 4 — Appointment Booking

**Status:** Tested (locally, against the in-memory MongoDB with **sample** opening hours; Atlas and email delivery not yet verified)
**Date:** 2026-10-22

## 1. Objective and business value

Let patients request an appointment online at a time that is actually free, without ever creating a double booking or promising a confirmation the clinic hasn't given. Clinic staff get a reliable record of each request, and patients get a reference they can use to check the status.

## 2. Files created or modified

| Area | Files |
|---|---|
| Time | `src/lib/time/ist.ts` (exact IST ↔ UTC helpers, formatting) |
| Booking domain | `src/features/appointments/{slots,schemas,reference,status-machine,spam,availability,service}.ts` |
| Notifications | `src/features/notifications/{email-provider,templates,service}.ts` |
| API | `src/app/api/public/{available-dates,slots}/route.ts`, `src/app/api/public/appointments/route.ts`, `src/app/api/public/appointments/status/route.ts`, `src/app/api/cron/notifications/route.ts` |
| UI | `src/components/forms/fields.tsx`, `src/components/appointments/{booking-form,status-lookup-form}.tsx`, `src/lib/api/client.ts`, `src/app/(public)/appointment/page.tsx` (form when booking is open), `src/app/(public)/appointment/status/page.tsx` (new), `src/components/contact/contact-blocks.tsx` (hours layout), `src/components/layout/public-shell.tsx` (dev sample-data banner) |
| Platform fixes | `src/lib/api/http.ts` (rethrow Next.js control-flow errors), `src/lib/errors.ts` (bulk-write duplicate-key detection), `src/lib/db/connection.ts` (removed global `sanitizeFilter`), `src/lib/db/models/appointment.ts` (required `patient`/`consent` sub-schemas), `src/config/env.server.ts` (email, cron and dev-data variables) |
| Dev data | `scripts/lib/database.ts` (`DEV_SAMPLE_WEEKLY_HOURS`), `scripts/with-db.ts` (applies sample hours, banner flag and a per-session salt **only** for the in-memory DB) |
| Tests | `tests/unit/{slots,booking-rules}.test.ts`, `tests/integration/booking.test.ts`, `tests/unit/server-helpers.test.ts` (bulk-error case), `tests/e2e/booking.spec.ts` |
| Dependencies | `react-hook-form` 7.90, `@hookform/resolvers` 5.9.2 (6.0 has an unresolvable peer-dependency tree) |
| Docs | this file, `API_DOCUMENTATION.md` (implementation status + deviations), `SECURITY.md`, `DATABASE_SCHEMA.md` §14, `IMPLEMENTATION_STATUS.md` |

## 3. Architecture and decisions

| Topic | Decision |
|---|---|
| **Time** | Instants stored in UTC; dates/times computed and shown in Asia/Kolkata using exact +05:30 arithmetic (India has no DST), so there are no timezone-library edge cases. |
| **Slot engine** | `computeDayAvailability()` is a pure function of rules, closures, holds, `now` and service duration. The *same* function lists slots and re-validates a submitted slot, so the server never trusts the browser's list. It handles breaks (multiple intervals per day), minimum notice, the advance window, full and partial closures, several chairs, and services longer than one slot (all covered grid slots must be free on one chair, inside one interval). |
| **Consistency model** | One transaction inserts one `slot_holds` document per covered grid slot plus the appointment. The unique `{resourceKey,start}` index lets exactly one transaction win. A loser that hits the duplicate key re-checks other chairs (capacity > 1), otherwise returns **409 `SLOT_UNAVAILABLE`** with up to 5 alternatives. |
| **Validity vs conflict** | A slot that would be valid if it were free → 409 (taken). A time that is never valid (past, inside the notice period, off-grid, closed day, holiday, outside the window) → 422. |
| **Idempotency** | The browser generates one UUID per form session and **keeps it after any failure**, so retries can't create a second booking. The server returns the original booking (`200`, `replayed: true`). Simultaneous duplicates that race are resolved by the unique `idempotencyKey` index. |
| **References** | `NAV-XXXX-XXXX-XX`: 10 symbols from a CSPRNG (~50 bits), Crockford Base32 (no I/L/O/U), so they can't be guessed and are easy to read out by phone. |
| **Booking mode** | `request` (default): status `pending`; every message says it is *not yet confirmed*. `instant`: status `confirmed`. |
| **Status machine** | Typed transition table; completed/no-show only after the start time; cancelled/rejected/no-show release holds **in the same transaction**; reschedule swaps holds atomically. Every change appends history and an audit entry. These services are ready for the Phase 6 admin. |
| **Status lookup** | `POST` with reference **and** mobile number, constant-time comparison, identical 404 for a wrong reference or a wrong phone, 10 per 10 minutes per IP. It returns only status, visit type and time. |
| **Spam** | Honeypot field, minimum 3 s fill time, maximum 24 h form age, per-IP (5/10 min) and per-phone (3/24 h) limits, 16 KB body cap, same-origin check. Spam gets a generic 422 and nothing is stored. Turnstile is deferred to Phase 8. |
| **Notifications** | Sent via `after()` once the response is sent; they never affect the booking. Each attempt is recorded (`sent` / `failed` / `skipped_not_configured` / `abandoned`) with the recipient masked. Messages are rebuilt from current data at send time. Retry backoff is 5 min → 30 min → 2 h → 12 h, then abandoned; 4xx provider errors are abandoned immediately. `GET /api/cron/notifications` (Bearer `CRON_SECRET`) processes due retries. The provider is Resend over HTTPS. Without `RESEND_API_KEY`/`EMAIL_FROM`, attempts are recorded as `skipped_not_configured`, never as sent. |
| **Sample hours (owner instruction)** | Mon–Sat 10:00–13:30 and 16:00–20:00, Sun closed. Applied **only** when `with-db` starts the in-memory DB, together with an orange "Development preview: sample data" banner. A database configured through `MONGODB_URI` keeps empty hours (online booking closed) until real hours are entered. |

## 4. Booking flow (as implemented)

1. `/appointment` renders the form only if hours exist, booking is enabled and a bookable service is published; otherwise it shows the phone-booking message.
2. Choose a service → `GET /api/public/available-dates` (first 12 shown, "Show more dates" for the rest).
3. Choose a date → `GET /api/public/slots` (live, uncached).
4. Enter details, tick the privacy acknowledgement (marketing opt-in is separate and optional), and submit.
5. The server runs, in order: origin → JSON/size/schema → spam → rate limits → live rules → service → slot re-validation → transaction → `201`.
6. The success screen (focus moves to its heading) shows the reference, time and honest wording, plus links to check status or call.
7. On `409`, the form keeps all details, refreshes the times and offers alternatives. On `422`, field errors appear inline plus a focused error summary. On a network error or `5xx`, retrying is safe because the idempotency key is kept.

## 5. Checks executed

| Command | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ 9 files, **105 tests passed** |
| `npx vitest run tests/integration/booking.test.ts` ×3 | ✅ 20/20 each run (concurrency tests stable) |
| `npm run build` | ✅ exit 0; no errors logged during prerender |
| `npx playwright test` | ✅ **80 passed**, 14 skipped by design (device-specific) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |

Key tests:
- **10 simultaneous patients, same slot →** exactly 1 booking and 1 hold; 9 get `SLOT_UNAVAILABLE`.
- **5 simultaneous identical submissions →** 1 booking, the same reference returned to all.
- **Capacity 2, 4 simultaneous →** 2 bookings on `chair-1` and `chair-2`.
- Past, inside-notice, off-grid, closed-day, holiday and out-of-window times → 422, with nothing stored.
- Cancel releases the slot (it can be rebooked); reschedule moves holds atomically and refuses taken times; invalid transitions → `INVALID_TRANSITION`; audit entries are written.
- Notifications: not configured → `skipped_not_configured`; a provider outage keeps the booking and schedules a retry, and the retry sends it; permanent errors are abandoned; no email address → no attempt.
- E2E (real browser): book → reference → status lookup; the error summary for an incomplete form; HTTP checks for 201/409 races, idempotent replay, 422 past time, 403 cross-site, 422 honeypot, 413 oversized body, 404 wrong phone, 429 rate limit, 401 cron without secret.

Bugs found and fixed while testing:
1. Mongoose's global `sanitizeFilter` (set in Phase 3) silently broke the app's own range queries. I removed it; injection is prevented by Zod primitives (documented).
2. `insertMany` duplicate-key errors carry no `keyPattern`, so slot conflicts surfaced as 500s. `isDuplicateKeyError` now handles bulk-write errors (unit-tested).
3. Route `catch` blocks swallowed Next.js's prerender bail-out signal (logged as 500 during build). `jsonError` now calls `unstable_rethrow` first.
4. `next start` (production mode) required `RATE_LIMIT_SALT`; the in-memory wrapper now provides a per-session salt.

## 6. Known issues / limitations

- **Email delivery not verified:** no Resend account or verified domain yet, so no real email has been sent. Do not treat email as working until a delivery test passes (Phase 10).
- **Real opening hours unknown:** a real database keeps online booking closed until the clinic's hours are entered (Phase 6 admin, or a settings update).
- Closures are rules, not holds (see ARCHITECTURE.md §4). A holiday added while a booking for that day is mid-submission may let that booking through; Phase 6 will list affected appointments when a closure is created.
- Patients cancel or reschedule by phone; there is no online self-service yet (by design).
- Turnstile CAPTCHA not enforced yet (Phase 8).
- No Vercel Cron schedule file yet; it will be added with deployment (Phase 10). Until then, retries can also be triggered from admin (Phase 6).
- The 3-second minimum fill time makes very fast autofill-and-submit fail with a generic message. This is acceptable for real users; it is documented for QA.

## 7. Completion checklist

- [x] Booking form with service, date, time, contact details, privacy acknowledgement and separate marketing consent
- [x] Server-fetched dates and slots; past and unavailable times cannot be selected
- [x] Independent server-side validation and slot re-validation
- [x] Database-enforced conflict protection with clear 409 and alternatives
- [x] Idempotent submissions
- [x] Non-guessable booking references and public status lookup (reference + phone)
- [x] Status machine with slot release and audit
- [x] Notifications recorded, failure-safe and retryable; cron endpoint
- [x] Request-based mode by default; never claims confirmation
- [ ] Real email delivery verified (needs Resend + domain)
- [ ] Real opening hours configured (needs clinic)

## 8. External inputs required

- **Opening hours, appointment length, chairs, minimum notice** (confirm or change the defaults of 30 min, 1 chair, 2 h).
- **Resend account + verified sending domain**, `EMAIL_FROM`, and the clinic **staff alert email(s)**.
- `CRON_SECRET` for production.
- MongoDB Atlas URI (from Phase 3).
