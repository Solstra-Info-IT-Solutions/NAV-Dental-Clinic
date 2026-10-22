# Implementation Roadmap

Each phase ends with its own `docs/PHASE_XX_*.md`, an update to `IMPLEMENTATION_STATUS.md`, and the checks listed. A phase is not marked **Tested** until its checks have actually been run and passed.

| Phase | Scope | Key outputs | Exit checks | Depends on client input? |
|---|---|---|---|---|
| **0 Discovery** | Audit, logo analysis, requirements, architecture | Audit, brand, design system, architecture, roadmap, status docs | Docs reviewed by owner | — |
| **1 Architecture & design system** | Finalise entities, API contracts, tokens, component conventions, security boundaries | `PHASE_01_ARCHITECTURE_DESIGN.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md` (contracts), `SECURITY.md` (draft) | Owner sign-off on contracts | Booking defaults (duration, capacity, notice) |
| **2 Setup & public UI** | `create-next-app` (TS strict, Tailwind v4, ESLint), tokens, fonts, provisional SVG logo, layout, header/mobile nav/footer, sticky action bar, Home, About, Services index + template, FAQ, Contact (UI), legal drafts, 404/error/loading | `PHASE_02_PUBLIC_UI.md`, `.env.example` | `lint`, `tsc --noEmit`, `build`, RTL tests for nav/buttons, Playwright smoke at 3 widths | Vector logo (else provisional), service list (else drafts) |
| **3 Backend & database** | Connection manager, models + indexes, `init-db`, settings/services/closures services, error envelope, logger, rate limiter | `PHASE_03_BACKEND_DATABASE.md`, `DATABASE_SCHEMA.md` (final) | Integration tests on in-memory replica set | Atlas cluster (can develop locally first) |
| **4 Appointment booking** | Slot engine, booking form, holds + transaction, idempotency, references, status machine, status lookup, notifications + retry + cron | `PHASE_04_APPOINTMENT_BOOKING.md` | Unit tests (slots/IST/status machine), **parallel conflict test**, idempotency test, e2e booking flow | Opening hours (to enable public booking) |
| **5 Contact & enquiries** | Contact form, spam/rate-limit, persistence, alerts, statuses | `PHASE_05_CONTACT_SYSTEM.md` | Integration + e2e | — |
| **6 Admin dashboard** | Better Auth, seed script, guards, dashboard counts, appointments (list/filter/paginate/detail/actions/manual/reschedule/notes), enquiries, schedule & closures & blocks, services, settings, audit log | `PHASE_06_ADMIN_DASHBOARD.md`, `ADMIN_GUIDE.md` | **Route-enumeration auth test**, transition tests, e2e admin flow | Admin user list |
| **7 SEO & content** | Metadata, canonical, OG image, sitemap, robots, JSON-LD, breadcrumbs, internal linking, copy review | `PHASE_07_SEO_CONTENT.md`, `SEO_STRATEGY.md` | Sitemap/robots tests, JSON-LD snapshot + Rich Results validation, noindex checks | Domain, GBP, verified hours/credentials |
| **8 Quality & security** | Security review, CSP, headers, a11y audit (axe + keyboard), performance (Lighthouse mobile, measured), dependency audit, secret scan | `PHASE_08_QUALITY_SECURITY.md`, `SECURITY.md` (final) | `npm audit`, axe in Playwright, Lighthouse report saved | — |
| **9 Testing** | Close coverage gaps; full test plan run | `PHASE_09_TESTING.md`, `TEST_PLAN.md` | All of master prompt §19 executed and reported | — |
| **10 Deployment & handover** | Vercel + Atlas + Resend + domain/HTTPS, production verification, backups/monitoring | `PHASE_10_DEPLOYMENT_HANDOVER.md`, `DEPLOYMENT.md`, `CLIENT_HANDOVER.md`, `PRODUCTION_READINESS_CHECKLIST.md` | Live smoke test, real email delivery test | Vercel/Atlas/Resend accounts, DNS access |

## Scripts that will exist (Phase 2)

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit + integration) |
| `npm run test:e2e` | Playwright |
| `npm run db:init` | Create indexes + default settings |
| `npm run admin:create` | Create the first owner (prompts for a password; never stored in the repo) |

## Critical path to a launchable site

1. Opening hours + appointment duration (enables booking).
2. Confirmed services list.
3. Domain + email domain (enables canonical SEO and email delivery).
4. Atlas, Vercel and Resend accounts owned by the clinic (or the agency, as agreed).
5. Approval of Privacy Policy and Terms drafts.
