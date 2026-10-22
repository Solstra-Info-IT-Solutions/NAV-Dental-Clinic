# Phase 1 — Architecture and Design System

**Status:** Implemented (documentation and contracts; no application code)
**Date:** 2026-10-22
**Approval basis:** The owner approved the Phase 0 proposed defaults ("start Phase 1 using the proposed defaults").

## 1. Objective and business value

Fix the contracts before code is written: data shapes, API surface, status rules, security boundaries and design tokens. Phases 2–6 can then be built and tested against a stable target, and the booking guarantees the clinic depends on (no double booking, honest "request received" messaging) are designed in rather than patched in.

## 2. Files created or modified

| File | Change |
|---|---|
| `.git/` + `.gitignore` | **New isolated repository** at `D:\NAV Dental Clinic` (branch `main`). It is no longer part of the drive-level `D:\` repo. `.gitignore` blocks `.env*` (except `.env.example`), build output and test artefacts. |
| `docs/DATABASE_SCHEMA.md` | New: all collections, fields, constraints, indexes, status table, retention |
| `docs/API_DOCUMENTATION.md` | New: envelopes, error codes, rate limits, every public/admin/cron endpoint |
| `docs/SECURITY.md` | New (draft): classification, boundaries, threat → control → test matrix, headers, auth, privacy |
| `docs/ARCHITECTURE.md` | Status set to approved |
| `docs/PHASE_01_ARCHITECTURE_DESIGN.md` | This file |
| `docs/IMPLEMENTATION_STATUS.md` | Updated |

Design tokens, typography, breakpoints and component conventions were already defined in `DESIGN_SYSTEM.md` (Phase 0) and are adopted unchanged.

## 3. Decisions made in this phase

| # | Decision | Rationale |
|---|---|---|
| D1 | **Slot holds collection** with a unique `{resourceKey, start}` index, written in transactions together with the appointment or block | A database-enforced guarantee covering both patient bookings and admin blocks, and it works for multi-slot services and for more chairs later |
| D2 | Request-mode bookings **hold** the slot while `pending` | Two patients must never be told "request received" for the same time |
| D3 | Release rule: `cancelled`, `rejected`, `no_show` release; everything else holds | Explicit, testable, matches the brief |
| D4 | Reschedule is a dedicated transactional action, not a status edit | Avoids a window where neither or both slots are held |
| D5 | Idempotency key per form session; replay returns the original reference with `200` | A retry or double-click is not a conflict |
| D6 | Status lookup via `POST` with reference **and** phone; identical 404s | Prevents enumeration and keeps phone numbers out of URLs and logs |
| D7 | Weekly hours as multiple intervals per day (breaks are the gaps) | One concept instead of hours + breaks; simpler validation |
| D8 | Closures are rules, not holds; creating one lists affected appointments | Avoids writing thousands of holds for a holiday; limitation documented |
| D9 | MongoDB-backed fixed-window rate limiter with a TTL index | Works on serverless without adding Redis/Upstash; good enough at clinic traffic |
| D10 | Roles: `owner` / `staff`; settings, services, exports, audit and users are owner-only | Least privilege for front-desk staff |
| D11 | Public read APIs cached briefly (60 s); slots, status and admin `no-store` | Fast public pages; no stale availability, no cached PII |
| D12 | Notifications after commit, every attempt recorded, retried by cron + manual retry | Email failure can never corrupt or hide a booking |
| D13 | Embedded Google Map only on approval and click-to-load; default is a directions link | Privacy, performance and a simpler CSP |
| D14 | No date-picker, UI-kit or animation dependencies | Smaller bundle; native controls are accessible and mobile-friendly |

## 4. Key flows

**Patient booking:** `/appointment` (Server Component renders the form shell and published services) → client fetches `/api/public/available-dates` → picks a date → `/api/public/slots` → submits to `POST /api/public/appointments` → server revalidates and runs the hold+appointment transaction → `201` with reference → success screen says *"Request received — the clinic will call you to confirm"* (request mode) → notification attempts recorded after commit.

**Conflict:** both requests pass validation → both transactions try to insert the same hold → MongoDB lets one commit; the other gets `E11000` → it aborts and returns `409 SLOT_UNAVAILABLE` with alternatives → the form highlights new slots without losing the patient's details.

**Admin status change:** Server Action → `requireAdmin('staff')` → Zod → status-machine check → transaction (update status, append history, delete holds if releasing) → audit log → notification (if requested) → `revalidatePath`.

## 5. Booking defaults now in effect (owner-approved, changeable in admin)

| Setting | Value |
|---|---|
| Booking mode | Request-based |
| Slot length | 30 min |
| Capacity | 1 chair |
| Minimum notice | 2 hours |
| Maximum advance | 30 days |
| Opening hours | **Empty**: public online booking stays off until hours are entered; phone/WhatsApp CTAs remain |
| WhatsApp button | Off until the number is confirmed on WhatsApp |
| Published services | Dental consultation only; 12 others as drafts |
| Retention | 24 months appointments / 12 months enquiries (purge script disabled until confirmed) |

## 6. Checks run

| Command | Result |
|---|---|
| `git init -b main` in `D:\NAV Dental Clinic` | Repository created; `git rev-parse --show-toplevel` → `D:/NAV Dental Clinic` |
| `git status --short` | Only `.gitignore`, `brand-assets/`, `docs/` untracked. Nothing committed yet. |

No lint, typecheck, test or build commands apply yet (no `package.json`; created in Phase 2).

## 7. Completion checklist

- [x] Stack and folder structure finalised (ARCHITECTURE.md)
- [x] Database entities, fields, constraints and indexes (DATABASE_SCHEMA.md)
- [x] API contracts with status codes, errors, auth and rate limits (API_DOCUMENTATION.md)
- [x] Design tokens, typography, breakpoints, component conventions (DESIGN_SYSTEM.md)
- [x] Security boundaries and threat/control matrix (SECURITY.md draft)
- [x] Status machine and slot-release rule defined
- [x] Repository isolated
- [ ] Initial commit (awaiting owner go-ahead)

## 8. External inputs still required

Unchanged from PHASE_00_DISCOVERY §3. Nothing blocks Phase 2. For Phase 2 specifically, a **vector logo** and the **confirmed services list** would avoid provisional work.
