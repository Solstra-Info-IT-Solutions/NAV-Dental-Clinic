# Phase 5 — Contact Form and Enquiries

**Status:** Tested (locally against the in-memory MongoDB; staff email delivery not yet verified)
**Date:** 2026-10-22

## 1. Objective and business value

Give patients a way to ask questions without phoning or opening an email app, and make sure every genuine message is stored safely for the clinic to answer. Spam is filtered without losing real enquiries.

## 2. Files created or modified

| Area | Files |
|---|---|
| Domain | `src/features/enquiries/{constants,schemas,service}.ts` |
| Notifications | `src/features/notifications/templates.ts` (`staffNewEnquiryEmail`), `src/features/notifications/service.ts` (`notifyEnquiryReceived`, enquiry subjects in the retry pipeline) |
| API | `src/app/api/public/enquiries/route.ts` |
| UI | `src/components/contact/contact-form.tsx`; `src/app/(public)/contact/page.tsx` ("Send a message" section + "Prefer to talk?" panel) |
| Model | `src/lib/db/models/enquiry.ts` (constants moved to a client-safe module so Mongoose never enters the browser bundle) |
| Tests | `tests/unit/enquiries.test.ts`, `tests/integration/enquiries.test.ts`, `tests/e2e/contact.spec.ts` |
| Docs | this file, `API_DOCUMENTATION.md`, `IMPLEMENTATION_STATUS.md` |

## 3. Decisions

| Topic | Decision |
|---|---|
| Fields | Name, mobile, optional email, topic (general / appointment / treatment information / feedback / other), message (10–2000 characters), privacy acknowledgement. No medical-history fields; the form warns against including any. |
| Validation | Shared Zod schemas: the browser gives instant feedback; the server re-validates everything and strips control characters before checking lengths. |
| Spam, layer 1 (refuse, store nothing) | Honeypot field, under 3 s to fill, form older than 24 h, cross-site origin, body over 16 KB. |
| Spam, layer 2 (limit) | 3 per 10 min per IP, 5 per 24 h per mobile number (MongoDB rate limiter, hashed keys). |
| Spam, layer 3 (store as `spam`) | A content score (several links, known spam phrases, long repeated characters). Flagged messages are **stored with status `spam`** for staff review, trigger no alert, and are **deleted automatically after 30 days** (TTL index). The sender receives the same "received" response as everyone else, so filtering can't be probed. |
| Duplicate protection | An idempotency key per form session, kept on errors. Simultaneous duplicates resolve to one record. |
| Staff alert | Sent to the configured staff emails after the response, only for non-spam enquiries. It is recorded and retried like appointment emails; `skipped_not_configured` when no provider is set up. **No auto-reply to the sender** (not requested, and it avoids becoming a relay for spam). |
| Status management | `updateEnquiry()`: new / in progress / resolved / spam, plus internal notes. Setting spam starts the 30-day timer and leaving spam cancels it. Audited without copying note text. `listEnquiries()`: pagination, status filter, escaped name/phone search. The admin screens that use these come in Phase 6. |
| WhatsApp | Offered alongside the form (only once the clinic confirms WhatsApp), never instead of it. |

## 4. Flow

Form → `POST /api/public/enquiries` → origin → JSON/size/schema → honeypot/timing → rate limits → idempotency check → content score → save (`new` or `spam`) → `201 { received: true }` → (after response, non-spam only) staff alert attempt recorded → success panel with focus on "Message sent".

## 5. Checks executed

| Command | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ 11 files, **120 tests passed** (15 new) |
| `npm run build` | ✅ exit 0, no errors logged during prerender |
| `npx playwright test` | ✅ **87 passed**, 17 skipped by design (device-specific) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |

Coverage includes: schema limits and friendly messages; control-character stripping; spam scoring; HTML escaping in the staff email; persistence with consent time; spam stored with expiry; 5 simultaneous duplicates → 1 record; status/notes update with audit (note text not copied); spam timer set and cleared; pagination and regex-safe search; staff alert sent when configured and skipped when not; E2E form submission in a real browser (desktop and mobile); accessible error summary; 201 / replay 200 / 422 field errors; honeypot and too-fast → 422; cross-site → 403; 4th message from the same IP within 10 min → 429; spam content gets an identical 201 response; axe scan of `/contact` with the form shows no serious or critical issues.

Visual review: contact page screenshots at 390 px and 1280 px.

## 6. Known issues / limitations

- Staff alert emails are not verified until Resend and the staff addresses are configured.
- Enquiries can be viewed and managed only through the service layer until the Phase 6 admin dashboard exists.
- The spam score is deliberately simple. Turnstile (Phase 8) is the next layer if real spam gets through.
- Retention purge for old enquiries (12 months proposed) is documented but not scheduled until the clinic confirms the period.

## 7. Completion checklist

- [x] Client-side and server-side validation
- [x] Sanitised, length-limited input
- [x] Spam protection (honeypot, timing, content score) and rate limiting
- [x] Safe error responses; loading, success and failure states
- [x] Database persistence with duplicate-submission protection
- [x] Staff email notification where configured (recorded and retryable)
- [x] Enquiry status management (service layer)
- [x] Works without the visitor's email app; WhatsApp offered as an alternative only
- [ ] Admin screens for enquiries (Phase 6)
- [ ] Staff email delivery verified (needs Resend + staff addresses)

## 8. External inputs required

- Staff email address(es) for enquiry alerts.
- Resend account and verified sending domain (shared with Phase 4).
- Confirmation of the enquiry retention period.
