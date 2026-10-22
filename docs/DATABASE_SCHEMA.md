# Database Schema

**Status:** Implemented in Phase 3 (2026-10-22) — models in `src/lib/db/models/`, indexes created by `npm run db:init`. Deviations from the Phase 1 contract are listed in §14.
**Database:** MongoDB Atlas (replica set, which multi-document transactions require). Database name: from `MONGODB_DB` (default `nav_dental`).
**ODM:** Mongoose 9, `strict: true`, `timestamps: true` on every collection unless noted.

## Conventions

| Topic | Rule |
|---|---|
| Instants | Stored as BSON `Date` in **UTC**. Displayed in `Asia/Kolkata`. |
| Clinic-local dates | Stored as `"YYYY-MM-DD"` strings (`localDate`) computed in IST, used for day filters and closures. This avoids timezone arithmetic in queries. |
| Clinic-local times | `"HH:mm"` 24-hour strings, validated `^([01]\d|2[0-3]):[0-5]\d$`. |
| Phone numbers | Normalised to E.164 (`+91XXXXXXXXXX`). Accepted input: an Indian mobile number (10 digits starting with 6–9) with optional `+91`, `91` or `0` prefix and spaces/dashes. |
| Strings | Trimmed; control characters stripped; maximum lengths enforced in **both** Zod and Mongoose. |
| IDs | `ObjectId`, except singleton settings (`_id: "default"`). |
| Soft data | No deletion of appointments from the UI; retention purge is a script (see §11). |
| Validation | Zod (in `features/*/schemas.ts`) is the primary gate. Mongoose validators are the backstop. |

## 1. `clinic_settings` (singleton)

| Field | Type | Constraints / default |
|---|---|---|
| `_id` | string | `"default"` |
| `clinicName` | string ≤ 80 | `"NAV Dental Clinic"` |
| `doctorName` | string ≤ 80 | `"Dr. Ratan Raghav"` |
| `doctorCredentials` | string ≤ 200 | `""` (not rendered while empty) |
| `doctorRegistrationNo` | string ≤ 60 | `""` |
| `phoneE164` | string | `"+918006606001"` |
| `whatsappEnabled` | boolean | `false` until confirmed |
| `whatsappE164` | string? | defaults to `phoneE164` when enabled |
| `email` | string? (email) | unset → "pending configuration", never displayed |
| `address` | `{ line1, line2, locality, district, state, postalCode?, country }` | line1 `"Somna Road"`, line2 `"Near Tata Kishan Kendra"`, locality `"Pahasu"`, district `"BSR"`, state `"Uttar Pradesh"`, country `"IN"` |
| `geo` | `{ lat, lng }?` | unset until verified |
| `mapUrl` | string? (https) | unset → map link built from an address search query |
| `googleBusinessProfileUrl` | string? | unset |
| `social` | `{ facebook?, instagram?, youtube?, x? }` | all unset |
| `weeklyHours` | `Record<"mon".."sun", { open: "HH:mm", close: "HH:mm" }[]>` | **all empty** → online booking disabled. Several intervals per day encode breaks (e.g. 10:00–13:30, 16:00–20:00). Intervals must be ordered, non-overlapping, and `open < close`. |
| `slotMinutes` | int | `30` (allowed: 10, 15, 20, 30, 45, 60) |
| `capacity` | int | `1` (1–5; each unit is a `resourceKey` `chair-1..n`) |
| `minNoticeMinutes` | int | `120` (0–10080) |
| `maxAdvanceDays` | int | `30` (1–180) |
| `bookingMode` | enum `request` \| `instant` | `request` |
| `bookingEnabled` | boolean | `true` (effective only when `weeklyHours` has at least one interval) |
| `notifications` | `{ staffEmails: string[] ≤ 5, patientAck: bool, patientStatusEmails: bool, staffNewBooking: bool, staffNewEnquiry: bool }` | staffEmails `[]`, all booleans `true` (sent only if the provider is configured) |
| `seo` | `{ titleTemplate, defaultTitle ≤ 60, defaultDescription ≤ 160, ogImageUrl? }` | Drafted in Phase 7 |
| `policies` | `{ cancellationText ≤ 1000, retentionMonthsAppointments: int, retentionMonthsEnquiries: int }` | `""`, `24`, `12` |
| `updatedBy` | ObjectId → user | |
| `version` | int | Optimistic concurrency: an update must send the current version, otherwise `409` |

Changing `slotMinutes` or `capacity` does **not** rewrite existing appointments. The settings screen warns when future active appointments are off the new grid.

## 2. `services`

| Field | Type | Constraints |
|---|---|---|
| `slug` | string | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 60, **unique** |
| `title` | string ≤ 80 | |
| `summary` | string ≤ 200 | Card text + meta description fallback |
| `sections` | `{ heading ≤ 100, body ≤ 3000 }[] ≤ 8` | Plain text with paragraph breaks. **No HTML is stored.** |
| `faqs` | `{ q ≤ 200, a ≤ 1000 }[] ≤ 10` | |
| `durationMinutes` | int? | Multiple of `slotMinutes`; defaults to one slot |
| `published` | boolean | `false` except `dental-consultation` |
| `bookable` | boolean | Appears in the booking dropdown only if `published && bookable` |
| `order` | int | Display order |
| `seo` | `{ title?, description? }` | |

Indexes: `{ slug: 1 }` unique; `{ published: 1, order: 1 }`.

Seed: the 13 candidate services from the brief, as drafts with patient-friendly copy for client review. Only `dental-consultation` is published.

## 3. `closures` (holidays and exceptional closures)

| Field | Type | Constraints |
|---|---|---|
| `startDate` | `"YYYY-MM-DD"` | |
| `endDate` | `"YYYY-MM-DD"` | `>= startDate`, span ≤ 60 days |
| `allDay` | boolean | |
| `startTime`, `endTime` | `"HH:mm"`? | Required when `!allDay`; the same partial window applies on each day in the range |
| `reason` | string ≤ 120 | Internal |
| `publicNote` | string ≤ 120? | Optional public notice ("Closed for Diwali") |
| `createdBy` | ObjectId | |

Index: `{ startDate: 1, endDate: 1 }`.

## 4. `slot_holds` — the double-booking guard

| Field | Type | Notes |
|---|---|---|
| `resourceKey` | string | `"chair-1"` … `"chair-n"` |
| `start` | Date (UTC) | Start of **one grid slot** |
| `holderType` | enum `appointment` \| `block` | |
| `holderId` | ObjectId | Appointment or slot-block id |
| `createdAt` | Date | No `updatedAt`; holds are immutable (inserted or deleted only) |

Indexes:
- **`{ resourceKey: 1, start: 1 }` unique**: a second insert for the same chair and slot fails with `E11000`, inside the transaction.
- `{ holderType: 1, holderId: 1 }`: release all holds of an appointment or block.
- `{ start: 1 }`: availability scan for a day range.

An appointment longer than one slot inserts one hold per covered grid slot. Holds are written **only** inside transactions that also write the holder document.

## 5. `slot_blocks` (admin manual blocks)

| Field | Type |
|---|---|
| `start`, `end` | Date (UTC), aligned to the grid, `end > start`, ≤ 12 h |
| `resourceKey` | string \| `"all"` (expands to one hold per chair) |
| `reason` | string ≤ 120 |
| `createdBy` | ObjectId |

Creating a block inserts its holds in a transaction. If any slot is already held, the request fails with `409` and lists the conflicting appointments. Deleting a block deletes its holds.

## 6. `appointments`

| Field | Type | Constraints |
|---|---|---|
| `reference` | string | `NAV-XXXX-XXXX-XX` (10 random Crockford Base32 chars, ~50 bits), **unique** |
| `patient.name` | string 2–80 | Letters, spaces, `.'-`, plus Devanagari |
| `patient.phoneE164` | string | Indian mobile |
| `patient.email` | string ≤ 120? | Optional |
| `serviceId` | ObjectId → services | Must be published and bookable at creation time |
| `serviceTitle` | string | Snapshot, so history survives service edits |
| `start`, `end` | Date (UTC) | Grid-aligned |
| `localDate` | `"YYYY-MM-DD"` (IST) | For day filters |
| `resourceKey` | string | |
| `status` | enum `pending`, `confirmed`, `reschedule_requested`, `completed`, `cancelled`, `rejected`, `no_show` | |
| `holdsSlot` | boolean | `true` for statuses that occupy the slot (see §8). Kept in sync by the status service. |
| `message` | string ≤ 500? | Patient note; the UI warns against detailed medical information |
| `consent.privacyAcknowledgedAt` | Date | **Required** |
| `consent.marketingOptIn` | boolean | Default `false`, separate from appointment processing |
| `consent.policyVersion` | string | Version of the privacy notice that was shown |
| `source` | enum `web` \| `admin` \| `phone` | |
| `idempotencyKey` | string (UUID v4)? | |
| `internalNotes` | `{ at, by, text ≤ 1000 }[]` | Admin only; never returned by public APIs |
| `history` | `{ at, by?, from?, to, action, note? }[]` | Append-only |
| `requestMeta` | `{ ipHash?, userAgentHash? }` | Salted SHA-256; no raw IP |
| `createdBy` | ObjectId? | Set for admin-created appointments |

Indexes:
- `{ reference: 1 }` unique
- `{ idempotencyKey: 1 }` unique, **partial** (`idempotencyKey: { $exists: true }`)
- `{ start: 1, status: 1 }`: calendar and day views
- `{ localDate: 1, status: 1 }`: dashboard "today"
- `{ status: 1, createdAt: -1 }`: pending queue
- `{ "patient.phoneE164": 1, createdAt: -1 }`: search, per-phone rate limiting, status lookup

Admin text search runs over `reference`, `patient.name` and `patient.phoneE164` using anchored, escaped regex on indexed fields (a text index is unnecessary at this scale).

## 7. `enquiries`

| Field | Type | Constraints |
|---|---|---|
| `name` | string 2–80 | |
| `phoneE164` | string | Indian mobile |
| `email` | string ≤ 120? | |
| `category` | enum `general`, `appointment`, `treatment-info`, `feedback`, `other` | |
| `message` | string 10–2000 | |
| `status` | enum `new`, `in_progress`, `resolved`, `spam` | Default `new` |
| `spam` | `{ honeypot: bool, fillMs: int, turnstile?: bool, score: int }` | |
| `privacyAcknowledgedAt` | Date | Required |
| `idempotencyKey` | string? | Unique, partial |
| `notes` | `{ at, by, text }[]` | Admin only |
| `requestMeta` | `{ ipHash? }` | |
| `spamExpiresAt` | Date? | Set when status = `spam` |

Indexes: `{ status: 1, createdAt: -1 }`; `{ idempotencyKey: 1 }` unique partial; `{ phoneE164: 1, createdAt: -1 }`; **TTL** `{ spamExpiresAt: 1 }, expireAfterSeconds: 0` (spam auto-deletes after 30 days).

## 8. Appointment status machine (authoritative)

| From \ To | confirmed | reschedule_requested | completed | cancelled | rejected | no_show |
|---|---|---|---|---|---|---|
| pending | ✅ | — | — | ✅ | ✅ | — |
| confirmed | — | ✅ | ✅ (start ≤ now) | ✅ | — | ✅ (start ≤ now) |
| reschedule_requested | ✅ (after reschedule) | — | — | ✅ | — | — |

Terminal states: `completed`, `cancelled`, `rejected`, `no_show`.

| Status | `holdsSlot` |
|---|---|
| pending, confirmed, reschedule_requested, completed | `true` |
| cancelled, rejected, no_show | `false` (holds deleted in the same transaction) |

`completed` keeps its hold so history cannot be double-booked retroactively. `no_show` releases it, which is harmless because the slot is in the past.

**Reschedule** is an action, not a status edit. In one transaction it inserts the new holds, deletes the old ones, updates `start/end/localDate`, sets the status to `confirmed`, and appends to history. In `bookingMode=instant`, new web bookings are created directly as `confirmed`.

## 9. `notification_attempts`

| Field | Type |
|---|---|
| `kind` | enum `appointment_received`, `appointment_confirmed`, `appointment_rescheduled`, `appointment_cancelled`, `appointment_rejected`, `staff_new_appointment`, `staff_new_enquiry` |
| `channel` | enum `email` (others reserved: `sms`, `whatsapp`) |
| `subjectType` / `subjectId` | `appointment` \| `enquiry`, ObjectId |
| `recipientMasked` | string (e.g. `r***@gmail.com`). The real address is resolved from the subject at send time, not duplicated here. |
| `audience` | `patient` \| `staff` |
| `status` | `pending`, `sent`, `failed`, `skipped_not_configured`, `abandoned` |
| `attempts` | int |
| `nextRetryAt` | Date? (backoff 5 min, 30 min, 2 h, 12 h; then `abandoned`) |
| `providerMessageId` | string? |
| `lastError` | string ≤ 500 (provider message, no PII) |

Indexes: `{ status: 1, nextRetryAt: 1 }`; `{ subjectType: 1, subjectId: 1 }`.

## 10. `audit_logs` (append-only, no `updatedAt`)

| Field | Type |
|---|---|
| `actorId` | ObjectId? (null for system/cron) |
| `actorEmail` | string (snapshot) |
| `action` | string, e.g. `appointment.status_changed`, `appointment.rescheduled`, `settings.updated`, `auth.login_failed`, `slot_block.created` |
| `entity` / `entityId` | string / string |
| `changes` | `{ field, from, to }[]`, minimised: patient contact fields are recorded as `"[changed]"` |
| `ipHash` | string? |
| `at` | Date |

Indexes: `{ entity: 1, entityId: 1, at: -1 }`; `{ at: -1 }`; `{ actorId: 1, at: -1 }`.

## 11. `rate_limits`

| Field | Type |
|---|---|
| `key` | string: `sha256(salt + scope + identifier)` |
| `windowStart` | Date |
| `count` | int |
| `expiresAt` | Date |

Indexes: `{ key: 1, windowStart: 1 }` unique; TTL `{ expiresAt: 1 }`. Implementation: a fixed-window `findOneAndUpdate` with `$inc` and `upsert` (atomic; duplicate-key races on upsert are retried once).

## 12. Authentication collections (Better Auth)

`user`, `session`, `account`, `verification`, managed by Better Auth's MongoDB adapter. Additional field on `user`: `role: "owner" | "staff"` (default `staff`, not settable from input). Public sign-up is disabled. Accounts are created by `npm run admin:create` or by an owner in the admin UI (Phase 6). The exact Better Auth configuration for disabled sign-up plus server-side user creation is verified against the installed version's docs in Phase 6.

## 13. Retention and initialisation

- `npm run db:init`: runs `syncIndexes()` for every model and upserts `clinic_settings` defaults and seed services (idempotent; never overwrites edited documents).
- `npm run db:purge`: deletes appointments whose `end` is older than `retentionMonthsAppointments` (plus their holds and notification attempts), and enquiries older than `retentionMonthsEnquiries`. It never runs automatically until the clinic approves the retention periods.
- **Backups:** Atlas continuous cloud backup (M10+) or scheduled `mongodump` for lower tiers. Documented in DEPLOYMENT.md.

## 14. Implementation deviations (Phase 3)

| Item | Phase 1 contract | Implemented | Reason |
|---|---|---|---|
| `services.sections` | `{ heading, body ≤ 3000 }` | `{ heading, paragraphs: string[] (each ≤ 3000) }` | Paragraph arrays render without storing or parsing any markup. |
| `services.redirectFrom` | Mentioned only in the API doc | `string[]`, indexed | Supports permanent redirects when a slug changes (Phase 7). |
| `clinic_settings.legalPagesApproved` | Not listed | `boolean`, default `false` | Controls the draft notice and `noindex` on legal pages. |
| `clinic_settings.seo.titleTemplate` | Listed | Not stored | The title template is fixed in code for consistency; default title/description remain editable. |
| `clinic_settings.address` | Inline object | Required sub-schema | Guarantees the address is always present (and typed as non-null). |
| Index creation | — | `autoIndex` disabled globally; `syncIndexes()` per model in `db:init` | Index builds never happen implicitly on production traffic. |
| Query safety | — | `sanitizeFilter: true`, `strictQuery: "throw"` set globally | Defence in depth against operator injection. |

