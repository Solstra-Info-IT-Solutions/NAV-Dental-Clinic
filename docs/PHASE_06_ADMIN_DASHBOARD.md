# Phase 6 — Secure Admin Dashboard

**Status:** Tested (locally against the in-memory MongoDB; not deployed)
**Date:** 2026-10-22

## 1. Objective and business value

Give clinic staff a secure, simple place to run the appointment book. They can review and confirm requests, take phone bookings, move or cancel appointments, block time, add holidays, answer enquiries, and change clinic details and opening hours without a developer. Enforcing permissions on the server means patient data stays private even if someone bypasses the screens.

## 2. Files created or modified

| Area | Files |
|---|---|
| Authentication | `src/lib/auth/{auth,guards,constants}.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts` (optimistic sign-in redirect) |
| Accounts | `src/features/admin-users/service.ts`, `scripts/admin-create.ts` (`npm run admin:create`) |
| Admin domain services | `src/features/appointments/admin.ts`, `src/features/schedule/service.ts`, `src/features/services/admin.ts`, `src/features/audit/service.ts` (listing), `src/features/notifications/service.ts` (listing), `src/features/enquiries/service.ts` (detail, export), `src/features/clinic-settings/repository.ts` (`getAdminSettings`), `src/features/appointments/status-machine.ts` (client-safe status list and labels), `src/lib/csv.ts` |
| Admin API (24 route files) | `src/app/api/admin/**` via the shared `src/lib/api/admin-route.ts` wrapper |
| Admin UI | `src/app/admin/{layout,login/page}.tsx`, `src/app/admin/(protected)/{layout,page}.tsx`, pages for appointments (list, new, detail), schedule, enquiries (list, detail), notifications, services (list, edit/new), settings, users, audit; components in `src/components/admin/*` |
| Platform | `src/config/env.server.ts` (`BETTER_AUTH_SECRET`/`URL`, `authSecret()`), `src/lib/security/rate-limit.ts` (admin limit), `scripts/lib/database.ts` (Better Auth indexes), `scripts/with-db.ts` (dev-only owner, per-session auth secret), `playwright.config.ts` + `tests/e2e/credentials.ts` (test-only owner) |
| Tests | `tests/integration/{auth,admin-services}.test.ts`, `tests/unit/admin-helpers.test.ts`, `tests/e2e/admin.spec.ts` |
| Dependencies | `better-auth` 1.7.12, `mongodb` 7.7.0 (pinned to the version Mongoose uses) |

## 3. Architecture and decisions

| Topic | Decision |
|---|---|
| Auth library | **Better Auth** email + password, sessions stored in MongoDB through its adapter on the shared Mongoose connection, created lazily (no DB access at build). Telemetry disabled. |
| Accounts | **No public sign-up** (`disableSignUp`; tested). The first owner comes from `npm run admin:create` (password typed hidden, or a generated one printed once). Further accounts are created by an owner in **Staff accounts**, which shows a one-time temporary password. Passwords are 12–128 characters, hashed by Better Auth (scrypt). |
| Roles | `owner` (everything) and `staff` (appointments, schedule, enquiries, notifications, slot blocks). Owner-only: settings, services, closures, exports, staff accounts, audit log. Disabled accounts cannot start sessions, and disabling, demoting or a password reset revokes all their sessions. The last active owner can't be removed or disabled. |
| Server-side authorisation | Every admin API route goes through `adminRoute(role, …)`: same-origin check for mutations → session + role → per-user rate limit (300/min) → handler, with `Cache-Control: no-store`. Every admin page calls `requireAdminPage(role)`. Menu filtering is cosmetic only. `proxy.ts` only redirects visitors without a session cookie and is not the security boundary. |
| Sessions and cookies | 8-hour sessions, refreshed hourly; `nav.` cookie prefix; `HttpOnly`, `SameSite=Lax`, `Secure` in production. |
| Login protection | Better Auth's limiter uses our MongoDB-backed counter (works across serverless instances): sign-in is limited to 5 attempts per 15 minutes per IP. Every success and failure is audited (failed emails masked). Messages never reveal whether an account exists. |
| CSRF | SameSite cookies, a same-origin check on all admin mutations, and Better Auth's origin check. Trusted origins are the canonical URL plus the request's own origin (needed for previews and local ports; still blocks cross-site requests). |
| Mutations from the UI | Client components call the documented admin API (one tested path), then `router.refresh()`. Status changes use accessible native `<dialog>` confirmations with an optional internal note and a "notify patient" option. |
| Cache Components | Admin pages read the session inside a `<Suspense>` boundary in the protected layout, so every page renders per request. Settings and service edits refresh public pages immediately with `revalidateTag(tag, { expire: 0 })`. |
| Data minimisation | Lists show masked phone numbers (`+91******1234`); full contact details only on the detail page. Exports are owner-only, limited to 92 days, use minimal fields, escape formulas, and are audited. The audit log never copies contact details or note text. |
| Closures | Never cancel appointments automatically. Creating one returns the affected appointments so staff can call those patients (closes the Phase 4 limitation for staff awareness). |
| Dev/test owner | Only the in-memory DB wrapper creates one (`DEV_ADMIN_EMAIL`/`DEV_ADMIN_PASSWORD`, or a random printed password). E2E uses a test-only credential constant. Neither touches a database configured through `MONGODB_URI`. |

## 4. Admin screens

Dashboard (counts straight from the database, upcoming appointments, recent enquiries, failed-notification warning) · Appointments (search by name, mobile or reference; status/date filters; pagination; sort; owner CSV export) · Appointment detail (patient, status actions allowed by the status machine, reschedule with live free times, internal notes, history, notification attempts with retry) · New appointment (phone/walk-in, same hold transaction, minimum notice ignored, never a taken or closed time) · Schedule (day grid per chair; block/unblock time; owner adds/removes closures) · Enquiries (list without spam by default, detail, status, notes, owner export) · Notifications (all or problems, retry, "email not set up" banner) · Services (owner: create, edit sections/FAQs/SEO, publish/bookable, delete refused when used) · Clinic settings (owner: details, contact, WhatsApp switch, weekly hours editor with breaks, booking rules, staff emails, notification switches, retention, legal approval) · Staff accounts (owner) · Audit log (owner).

## 5. Checks executed

| Command | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ 14 files, **140 tests passed** (20 new) |
| `npm run build` | ✅ exit 0; admin pages render per request, admin APIs dynamic |
| `npx playwright test` | ✅ **99 passed**, 23 skipped by design (device-specific) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |

Key tests:
- **Route-enumeration security test:** discovers all admin route files (≥ 30 method/path pairs) and asserts **401** for anonymous requests on every one. A real **staff** session gets **403** on every owner-only endpoint and is never refused on staff endpoints. A cross-site admin mutation gets 403, and public sign-up is refused.
- Integration: hashed passwords, sign-in, audit of successes and failures, sign-up blocked, role checks, disable → sessions revoked and sign-in refused, password reset → old sessions and password invalid, last-owner protection, duplicate emails.
- Integration: staff bookings, filters and search, notes, dashboard counts, staff slots incl. rescheduling, CSV formula escaping and range limit, slot blocks (conflict list, release on delete, off-grid refused), closures listing affected appointments (all-day and partial), cancellation freeing the schedule, service slug redirects, delete refused when used, settings with version.
- E2E browser flow: a patient books online → the owner signs in → confirms with a note → the patient's status lookup shows *confirmed* → the audit log shows the change → sign-out → `/admin` redirects to sign-in. The wrong-password message is generic, and signed-out visitors are redirected with `noindex`.
- **axe WCAG 2.2 AA scan of the sign-in page and all 10 admin screens: no serious or critical violations.**

Issues found and fixed during this phase:
1. Updating a service with no duration sent `$set` and `$unset` on the same field (MongoDB conflict).
2. Better Auth rejected sign-ins from any origin except the configured URL (broke previews and local ports); fixed with request-origin trust, and CSRF protection is kept.
3. Wide admin tables weren't keyboard-scrollable (axe `scrollable-region-focusable`); they are now focusable, labelled regions.
4. Better Auth collections had no indexes; `db:init` now creates a unique email index and session/account indexes.

Visual review: dashboard, appointment detail, schedule, settings and mobile appointments list checked from screenshots.

## 6. Known issues / limitations

- **No self-service password reset** (it needs working email). The owner resets staff passwords in Staff accounts; a locked-out sole owner uses `npm run admin:create` with a new email, or a developer resets the password. Revisit once Resend is configured.
- **No two-factor authentication yet.** Recommended for the owner account before launch (Better Auth has a TOTP plugin). Decision deferred to the client.
- Owner "book outside opening hours" override (in the Phase 1 contract) is **not implemented**. Staff can temporarily edit hours or add the time range if needed.
- A typed date can be lost if staff type into a form before the page finishes loading (seen only in automated tests that type instantly).
- Self-hosted deployments must ensure `X-Forwarded-For` is set by a trusted proxy (it keys login and API rate limits).
- Retention purge script not yet scheduled (waiting for the clinic to confirm periods).

## 7. Completion checklist

- [x] Secure sign-in and sign-out, server-side session validation, secure cookies
- [x] Role-based access (owner/staff) enforced on every API route and page
- [x] Login rate limiting; no hardcoded or default production passwords; no public sign-up
- [x] Dashboard with real counts only
- [x] Appointment search, filters, pagination, detail, status changes, reschedule, cancellation, manual bookings, internal notes, history
- [x] Slot blocking and holidays/closures (with affected-appointment list)
- [x] Enquiry listing, search, detail, status, spam handling, notes, owner export
- [x] Clinic settings incl. opening hours, booking rules, notifications, legal approval
- [x] Services management
- [x] Audit trail for important changes; audit log viewer
- [x] Notification monitoring and retry
- [ ] Password reset by email (needs Resend)
- [ ] Two-factor authentication (client decision)

## 8. External inputs required

- Names and emails of the people who need accounts, and who should be owner.
- `BETTER_AUTH_SECRET` (long random string) and `BETTER_AUTH_URL` for production.
- A decision on two-factor authentication for the owner.
