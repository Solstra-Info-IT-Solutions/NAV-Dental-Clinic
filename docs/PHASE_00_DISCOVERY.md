# Phase 0 — Discovery and Requirements

**Status:** Implemented (documentation phase; no application code yet)
**Date:** 2026-10-22

## 1. Objective and business value

Establish verified facts, gaps, requirements and acceptance criteria **before** writing code so that:
- branding comes from the real logo, not a generic dental template;
- nothing about the clinic (hours, services, qualifications, email) is invented;
- the booking system's guarantees (no double booking, request-based confirmation) are agreed up front.

## 2. Verified business facts (supplied by client)

| Field | Value |
|---|---|
| Clinic name (from logo) | NAV Dental Clinic |
| Doctor | Dr. Ratan Raghav |
| Category | Dental clinic |
| Booking phone | 8006606001 → stored as E.164 `+918006606001` |
| Address | Somna Road, Near Tata Kishan Kendra, Pahasu, BSR (Bulandshahr), Uttar Pradesh, India |
| Timezone | Asia/Kolkata (IST, UTC+05:30, no DST) |
| Currency | INR (only if prices are ever shown; none are planned) |
| Language | English default; Hindi-ready architecture |
| Logo | Supplied (3D render), analysed in BRAND_ANALYSIS.md |

> Assumption to confirm: "BSR" = **Bulandshahr** district. We will display "BSR" exactly as supplied until the client confirms the expanded form for SEO and structured data.

## 3. Missing information (blocks specific features, not the build)

| # | Item | Needed for | Default until supplied |
|---|---|---|---|
| 1 | **Is 8006606001 on WhatsApp?** | WhatsApp button (`wa.me/918006606001`) | Button hidden behind a settings flag `whatsappEnabled=false` |
| 2 | Opening hours, weekly off-day, lunch break | Slot generation, footer, contact page, JSON-LD `openingHours` | Booking calendar shows "Online booking opens once hours are configured", phone CTA shown. Hours **omitted** from structured data. |
| 3 | Appointment duration and number of patients per slot (one chair / one dentist?) | Slot engine | Proposed defaults in admin: 30 min, capacity 1 (must be confirmed before go-live) |
| 4 | **Confirmed list of services** | Service pages, booking dropdown, sitemap | All 13 candidate services stored as **draft/unpublished**; only "Dental consultation" published until approved |
| 5 | Dr. Raghav's qualifications (BDS/MDS), university, State Dental Council registration no., experience | About page, Person/Dentist schema | Section shows name and role only; no credentials rendered |
| 6 | Clinic email | Footer, privacy contact, email sender/reply-to | Marked **pending configuration**; not displayed |
| 7 | Clinic staff alert email(s) | New-booking alerts | Required before launch |
| 8 | Domain | Canonical URLs, sitemap, OG, email sending domain | `NEXT_PUBLIC_SITE_URL` env var; `noindex` on non-production hosts |
| 9 | Social links | Footer, `sameAs` | Hidden when empty |
| 10 | Google Business Profile URL and exact map pin (lat/lng) | Map, directions, `geo` | Map uses address search query; no coordinates in schema until verified |
| 11 | Vector logo | Header, favicon, OG image, email | Provisional traced SVG, flagged for approval |
| 12 | Photography (doctor, clinic exterior/interior, reception) | About, home, contact | Typographic and graphic layouts that need no stock "fake clinic" photos |
| 13 | Cancellation/reschedule policy and minimum notice | FAQ, terms, slot rules | Proposed: min notice 2 h, max advance 30 days, cancellations by phone. Must be confirmed. |
| 14 | Data retention period for appointments/enquiries | Privacy policy, purge job | Proposed 24 months for appointments, 12 months for enquiries (client to confirm) |
| 15 | Who are the admin users (names/roles) | Admin seeding | One owner account created by a CLI seed script with a password set at runtime |
| 16 | Hindi content needed at launch? | i18n scope | English only at launch; dictionary structure ready |
| 17 | Booking mode | Workflow | **Request-based** (staff confirms) |

## 4. Functional requirements (summary)

**Public site:** Home, About, Services index + service pages, Appointment, Contact, FAQ, Privacy Policy, Terms, 404, error and loading states. Click-to-call and WhatsApp everywhere; sticky mobile action bar.

**Booking:** server-generated slots from configurable hours, breaks, holidays, blocks, min notice and max window; request-based by default; server revalidation; DB-enforced slot exclusivity; idempotent submission; non-guessable reference; status lifecycle with audit; notifications with failure recording and retry.

**Contact:** validated, rate-limited, spam-protected, persisted enquiries with status management and optional email alert.

**Admin:** secure login, dashboard of real counts, appointment and enquiry management, manual bookings, slot blocking, clinic settings, services management, audit log.

**SEO:** Metadata API, canonical, OG, sitemap, robots, Dentist + WebSite + BreadcrumbList + Service JSON-LD from verified settings only, admin `noindex`.

**Non-functional:** WCAG 2.2 AA target, mobile-first, Server Components by default, strict TypeScript, no secrets in client bundles, measured (not claimed) Lighthouse scores.

## 5. Assumptions (recorded, reversible)

1. Single dentist, single chair → **slot capacity 1** (the model supports capacity > 1 later via a `resourceKey`).
2. Request-based booking: a submitted request **holds** the slot (status `pending`) so two patients cannot request the same time; staff then confirm or reject. Rejecting/cancelling releases the slot.
3. Patients are not given accounts. They can check status with **reference + registered mobile number**.
4. No online payments, no pricing on the website.
5. No medical history collected. The booking message field is optional, limited to 500 characters, and warns patients not to share detailed medical information.
6. Email via **Resend** with a verified sending domain once the domain exists. Until then, notifications are recorded as `skipped_not_configured`, not as sent.
7. SMS/WhatsApp **API** notifications are out of scope until a provider, business verification and templates exist. The WhatsApp **click-to-chat** link is in scope.
8. Hosting: Vercel (Mumbai region `bom1` for functions) + MongoDB Atlas (Mumbai `ap-south-1`) to keep data and latency in India.

## 6. Acceptance criteria for the whole project

Taken from master prompt §19 and adopted verbatim as the release gate. They are tracked per phase in `IMPLEMENTATION_STATUS.md`. Key booking-specific criteria:

- [ ] Two concurrent requests for the same slot → exactly one `201`, the other `409 SLOT_UNAVAILABLE` (automated test with parallel requests against a real MongoDB).
- [ ] Same idempotency key submitted twice → one record, same reference returned.
- [ ] Past dates, dates beyond the window, closed days, holidays, blocked slots and off-grid times → `422` from the server even when the client is bypassed.
- [ ] Notification provider failure → booking still `201`; a `NotificationAttempt` with `status=failed` exists and is retryable from admin.
- [ ] Every `/api/admin/*` route and admin server action → `401/403` without a valid session (automated test enumerating routes).
- [ ] Admin pages carry `noindex` and are excluded from the sitemap.

## 7. Decisions needed from the client/owner now

See the "Essential questions" in the Phase 0 report. Only **#1 (git isolation)** blocks Phase 2 code. Everything else has a safe default above.

## 8. Phase 0 completion checklist

- [x] Repository audited (`PROJECT_AUDIT.md`)
- [x] Logo located, inspected and measured (`BRAND_ANALYSIS.md`)
- [x] Design system derived from the logo (`DESIGN_SYSTEM.md`)
- [x] Architecture proposed (`ARCHITECTURE.md`)
- [x] Roadmap written (`IMPLEMENTATION_ROADMAP.md`)
- [x] Status tracker created (`IMPLEMENTATION_STATUS.md`)
- [x] Missing business details listed with safe defaults
- [ ] Client answers to the open questions
