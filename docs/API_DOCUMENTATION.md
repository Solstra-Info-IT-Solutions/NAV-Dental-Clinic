# API Documentation (Contracts)

**Status:** Contracts finalised in Phase 1. See "Implementation status" below for what has shipped.

## Implementation status

| Endpoint | Phase | Status |
|---|---|---|
| `GET /api/public/settings`, `GET /api/public/services`, `GET /api/public/services/{slug}` | 3 | Implemented, tested |
| `GET /api/public/available-dates`, `GET /api/public/slots` | 4 | Implemented, tested |
| `POST /api/public/appointments`, `POST /api/public/appointments/status` | 4 | Implemented, tested |
| `GET /api/cron/notifications` | 4 | Implemented, tested (401 without secret; delivery path unit/integration-tested) |
| `POST /api/public/enquiries` | 5 | Not started |
| `/api/auth/*`, `/api/admin/*` | 6 | Not started. The status-change and reschedule **services** they will call already exist and are tested. |

Deviations from the Phase 1 contract (Phase 4):

- `GET /api/public/available-dates` returns `{ from, lastAllowed, dates: [{ date, available }] }` (adds `from`/`lastAllowed` so the form knows the window).
- `409 SLOT_UNAVAILABLE` alternatives are `[{ start, label, date }]` (adds `date` so suggestions can span days).
- `POST /api/public/appointments` success also returns `emailWillBeSent` (true only if the patient gave an email, patient acknowledgements are enabled and an email provider is configured). It never claims delivery.
- `publicClosures` is not yet included in `GET /api/public/settings`; closures are applied server-side to dates and slots.
- Cloudflare Turnstile is **not yet enforced** (`turnstileToken` is accepted and ignored) until the widget and CSP are added in Phase 8.
**Base path:** `/api`. All bodies are JSON (`Content-Type: application/json`), max **16 KB**. All times are ISO-8601 UTC strings (`2026-11-03T04:30:00.000Z`); `localDate` is `YYYY-MM-DD` in Asia/Kolkata.

## 0. Common rules

### Response envelopes

```jsonc
// success
{ "data": { /* endpoint-specific */ } }
// success, paginated
{ "data": [ ... ], "page": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 } }
// error
{ "error": { "code": "VALIDATION_FAILED", "message": "Please correct the highlighted fields.",
             "fields": { "patient.phone": "Enter a valid 10-digit Indian mobile number." },
             "requestId": "01J…" } }
```
`message` is always safe to show to users. Stack traces, database errors and internal identifiers are never returned. The `requestId` is logged server-side for support.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON, wrong content type |
| 401 | `UNAUTHENTICATED` | No/expired admin session |
| 403 | `FORBIDDEN` | Session valid but role insufficient, or cross-origin mutation |
| 404 | `NOT_FOUND` | Resource missing, **or** status lookup mismatch (same shape either way) |
| 409 | `SLOT_UNAVAILABLE` | Slot taken between listing and submit; includes `alternatives` |
| 409 | `INVALID_TRANSITION` | Status change not permitted |
| 409 | `VERSION_CONFLICT` | Settings edited concurrently |
| 413 | `PAYLOAD_TOO_LARGE` | Body > 16 KB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not JSON |
| 422 | `VALIDATION_FAILED` | Zod or business-rule failure (past date, closed day, off-grid time, unpublished service, …) |
| 422 | `BOOKING_DISABLED` | No hours configured or booking switched off |
| 429 | `RATE_LIMITED` | Includes a `Retry-After` header |
| 500 | `INTERNAL` | Unexpected; logged with `requestId` |
| 503 | `SERVICE_UNAVAILABLE` | Database unreachable |

### Cross-cutting controls

- **Mutations** (`POST/PATCH/PUT/DELETE`) require a same-origin request: the `Origin` header must match `NEXT_PUBLIC_SITE_URL` (or the deployment host in preview), or `Sec-Fetch-Site: same-origin`. Otherwise `403`. No CORS headers are emitted, so the API is not callable cross-origin from browsers.
- **Caching:** public read endpoints send `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, except `/slots` and `/appointments/status` (`no-store`). All admin endpoints send `no-store`.
- **Admin endpoints** call `requireAdmin(role)` before parsing input. Without a session they return `401`; with an insufficient role, `403`. Roles: `owner` can do everything; `staff` can do everything **except** settings, services, user management and audit-log access.
- **Admin UI** may use Server Actions instead of fetch. Those actions call the same feature services behind the same `requireAdmin` guard and Zod schemas. The Route Handlers below are the documented, tested contract.

### Rate limits (fixed window, keyed on salted hash)

| Scope | Limit |
|---|---|
| `slots` per IP | 60 / min |
| `appointments.create` per IP | 5 / 10 min, and per phone 3 / 24 h |
| `appointments.status` per IP | 10 / 10 min |
| `enquiries.create` per IP | 3 / 10 min, and per phone 5 / 24 h |
| `auth.sign-in` per IP | 5 / 15 min, and per email 10 / h (Better Auth limiter + ours) |
| `admin/*` per session | 300 / min |

---

## 1. Public endpoints (no authentication)

### `GET /api/public/settings`
Public subset of clinic settings.
**200** `{ data: { clinicName, doctorName, doctorCredentials?, phoneE164, whatsappE164?, address, mapUrl?, geo?, social, weeklyHours, bookingEnabled, bookingMode, slotMinutes, maxAdvanceDays, publicClosures: [{ startDate, endDate, publicNote }] } }`
Never includes staff emails, notification settings, internal reasons or `version`.

### `GET /api/public/services`
**200** `{ data: [{ slug, title, summary, bookable, durationMinutes }] }`, published services only, ordered.

### `GET /api/public/services/{slug}`
**200** full published service (`sections`, `faqs`, `seo`). **404** if unpublished or unknown.

### `GET /api/public/slots?date=YYYY-MM-DD&service={slug}`
Available start times for one clinic day.
**Validation:** `date` within `[today, today + maxAdvanceDays]` IST; `service` published and bookable.
**200**
```json
{ "data": { "date": "2026-11-03", "timezone": "Asia/Kolkata", "closed": false,
  "slots": [ { "start": "2026-11-03T04:30:00.000Z", "label": "10:00 AM" } ] } }
```
`closed: true` with an optional `note` when the clinic is closed that day. Excludes slots before `now + minNotice`, closures, and held slots (a slot is offered if **any** chair is free for the whole service duration).
**Errors:** 422 (`VALIDATION_FAILED`, `BOOKING_DISABLED`), 429.

### `GET /api/public/available-dates?service={slug}&from=YYYY-MM-DD&days=14`
**200** `{ data: [{ date, available: boolean }] }`. Lets the calendar disable full or closed days. `days` ≤ 31.

### `POST /api/public/appointments`
Create an appointment request.
**Request**
```jsonc
{
  "idempotencyKey": "uuid-v4",
  "patient": { "name": "string 2-80", "phone": "Indian mobile", "email": "optional email" },
  "service": "slug",
  "start": "ISO UTC (must equal a slot from /slots)",
  "message": "optional ≤ 500",
  "privacyAcknowledged": true,          // must be literally true
  "marketingOptIn": false,
  "policyVersion": "2026-10-22",
  "hp": "",                              // honeypot, must be empty
  "formStartedAt": 1761123456789,        // ms epoch; submissions faster than 3 s are flagged
  "turnstileToken": "optional, required when Turnstile is configured"
}
```
**Server steps:** origin check → rate limit → Zod → spam checks → settings/service/closure revalidation → transaction (holds + appointment) → commit → notifications (non-blocking) → response.
**201**
```json
{ "data": { "reference": "NAV-K7Q2-M9XD-4T", "status": "pending",
  "start": "…", "serviceTitle": "Dental consultation",
  "message": "Request received. The clinic will call you to confirm.",
  "patientEmailQueued": true } }
```
**200** (idempotent replay, same key): same body plus `"replayed": true`.
**409** `SLOT_UNAVAILABLE` with `error.alternatives: [{ start, label }]` (up to 5 slots on the same or the next available day).
**422**, **429**, **403**. A spam-flagged submission returns a generic **422** and stores nothing.

### `POST /api/public/appointments/status`
POST (not GET) so the phone number never appears in URLs or logs.
**Request** `{ "reference": "NAV-XXXX-XXXX-XX", "phone": "Indian mobile" }`
**200** `{ data: { reference, status, serviceTitle, start } }`. Name, notes and history are never returned.
**404** `NOT_FOUND` for unknown references **and** for phone mismatches (identical shape and similar timing). **429**.
Patients cancel or reschedule by phone/WhatsApp at launch. A self-service cancel endpoint can be added later behind the same reference+phone check.

### `POST /api/public/enquiries`
**Request** `{ idempotencyKey, name, phone, email?, category, message, privacyAcknowledged: true, hp, formStartedAt, turnstileToken? }`
**201** `{ data: { received: true } }`. **200** on idempotent replay. **422**, **429**, **403**.

---

## 2. Authentication

### `GET|POST /api/auth/*`
Better Auth handler. Endpoints used: `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`, `GET /api/auth/get-session`, plus password reset routes if email is configured (Phase 6). Sign-up endpoints are disabled. Session cookie: `HttpOnly`, `Secure` (production), `SameSite=Lax`, 8 h expiry with sliding refresh, `__Secure-` prefix in production. Failed and successful sign-ins are audited (email masked).

---

## 3. Admin endpoints (session required)

All admin endpoints return `401` without a session and `403` for an insufficient role. `{id}` must be a valid ObjectId, otherwise `404`.

### Dashboard

#### `GET /api/admin/dashboard` (staff)
**200** `{ data: { today: { total, pending, confirmed }, counts: { pending, confirmed, completed, cancelled, rejected, no_show }, upcoming: AppointmentSummary[≤10], recentEnquiries: EnquirySummary[≤5], failedNotifications: number } }`. Every number comes from a database count.

### Appointments

#### `GET /api/admin/appointments` (staff)
Query: `page` (≥1), `pageSize` (10–100, default 20), `status` (comma-separated), `from`, `to` (localDate), `q` (≤ 60: reference, name or phone), `sort` (`start` | `-start` | `-createdAt`).
**200** paginated `AppointmentSummary { id, reference, patientName, phoneMasked, serviceTitle, start, status, source, createdAt }`. The full phone number appears only in the detail view.

#### `GET /api/admin/appointments/{id}` (staff)
**200** full appointment including `patient`, `history`, `internalNotes` and notification attempts.

#### `POST /api/admin/appointments` (staff)
Manual booking (phone or walk-in).
`{ patient, service, start, message?, source: "phone"|"admin", status: "pending"|"confirmed", notifyPatient: boolean, overrideMinNotice?: boolean, overrideHours?: boolean }`
Uses the same hold transaction. Admins may book inside the minimum-notice window, but **never** onto a held slot or outside opening hours unless `overrideHours: true` (owner only, audited).
**201** `{ data: { id, reference } }`. **409** `SLOT_UNAVAILABLE`, **422**.

#### `POST /api/admin/appointments/{id}/status` (staff)
`{ to: "confirmed"|"completed"|"cancelled"|"rejected"|"no_show"|"reschedule_requested", note?: string ≤ 500, notifyPatient?: boolean }`
**200** updated appointment. **409** `INVALID_TRANSITION`. Releases holds when the target status does not hold the slot (see DATABASE_SCHEMA §8).

#### `POST /api/admin/appointments/{id}/reschedule` (staff)
`{ start: ISO, note?: string, notifyPatient?: boolean }` → **200**, **409** `SLOT_UNAVAILABLE` | `INVALID_TRANSITION`, **422**.

#### `POST /api/admin/appointments/{id}/notes` (staff)
`{ text: string 1–1000 }` → **201**.

#### `GET /api/admin/appointments/export?from&to&status` (owner)
CSV of the minimum needed fields (reference, date, time, service, name, phone, status). Max range 92 days; audited; `Content-Disposition: attachment`; `no-store`. Cells starting with `=`, `+`, `-` or `@` are escaped to prevent CSV injection.

### Schedule

#### `GET /api/admin/schedule?date=YYYY-MM-DD` (staff)
**200** the day grid with each slot's state (`free`, `appointment`, `block`, `closed`) and holder summary.

#### `POST /api/admin/slot-blocks` (staff)
`{ start, end, resourceKey: "chair-1"|…|"all", reason }` → **201**; **409** with `conflicts: AppointmentSummary[]`.

#### `DELETE /api/admin/slot-blocks/{id}` (staff) → **204**.

#### `GET /api/admin/closures` · `POST /api/admin/closures` · `DELETE /api/admin/closures/{id}` (owner)
`POST` body per DATABASE_SCHEMA §3. **201** `{ data: { id, affectedAppointments: AppointmentSummary[] } }`: closures never cancel appointments automatically; affected appointments are listed for staff to act on.

### Services (owner)

`GET /api/admin/services` · `POST /api/admin/services` · `GET|PATCH|DELETE /api/admin/services/{id}`
`DELETE` is refused (`409`) if any appointment references the service; unpublish it instead. Slug changes keep the old slug in `redirectFrom[]` for a permanent redirect (Phase 7).

### Settings (owner)

#### `GET /api/admin/settings` → full settings including `version`.
#### `PATCH /api/admin/settings`
`{ version: int, changes: Partial<Settings> }`. Validated by the full settings schema after merge. **409** `VERSION_CONFLICT`. On success: `revalidateTag('clinic-settings')` and an audit entry with changed field names.

### Enquiries (staff)

- `GET /api/admin/enquiries?page&pageSize&status&q&from&to`: paginated, phone masked in the list.
- `GET /api/admin/enquiries/{id}`
- `PATCH /api/admin/enquiries/{id}` `{ status?: "new"|"in_progress"|"resolved"|"spam", note?: string }`
- `GET /api/admin/enquiries/export` (owner): same safeguards as the appointment export.

### Notifications (staff)

- `GET /api/admin/notifications?status=failed`
- `POST /api/admin/notifications/{id}/retry` → **200** with the new attempt status.

### Audit log (owner)

- `GET /api/admin/audit?entity&entityId&page`

### Users (owner, Phase 6)

- `GET /api/admin/users` · `POST /api/admin/users` `{ name, email, role }` (sends a set-password link when email is configured; otherwise returns a one-time temporary password shown once) · `PATCH /api/admin/users/{id}` `{ role?, disabled? }`. An owner cannot demote or disable the last owner.

---

## 4. Cron

### `GET /api/cron/notifications`
Requires `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this), otherwise `401`. Retries due `failed` attempts (max 50 per run). **200** `{ data: { processed, sent, failed, abandoned } }`.

---

## 5. Shared type sketches

```ts
type AppointmentStatus = "pending" | "confirmed" | "reschedule_requested" | "completed" | "cancelled" | "rejected" | "no_show";
type AppointmentSummary = { id: string; reference: string; patientName: string; phoneMasked: string; serviceTitle: string; start: string; status: AppointmentStatus; source: "web" | "admin" | "phone"; createdAt: string };
type EnquirySummary = { id: string; name: string; phoneMasked: string; category: string; status: "new" | "in_progress" | "resolved" | "spam"; createdAt: string };
```
The canonical definitions are the Zod schemas in `src/features/*/schemas.ts`; TypeScript types are inferred from them (`z.infer`).
