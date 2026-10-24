# Test Plan — NAV Dental Clinic

How the project is tested, and where each acceptance criterion from the brief (§19) is proven. All automated tests run on **throwaway data**: the in-memory MongoDB replica set that `scripts/with-db.ts` starts, seeded with **sample** opening hours. They never touch a real database.

## 1. Test layers

| Layer | Tool | Location | What it covers |
|---|---|---|---|
| Unit | Vitest (jsdom/node) | `tests/unit/*.test.ts(x)` | Pure logic: IST time, slot engine, schemas, references, status machine, spam signals, templates, SEO builders, CSV, logger, HTTP helpers, navigation components |
| Integration | Vitest + `mongodb-memory-server` replica set | `tests/integration/*.test.ts` | Services against a real MongoDB: transactions, unique indexes, concurrency, auth, admin services, notifications, retention |
| End-to-end | Playwright (desktop Chrome + Pixel 7) against `npm run start` (production build) | `tests/e2e/*.spec.ts` | Real HTTP and browser: pages, forms, APIs, admin, security headers, SEO, accessibility (axe), keyboard |
| Static | ESLint (`next/core-web-vitals` + TS), `tsc --noEmit` (strict) | — | Code quality, types |
| Manual / measured | Lighthouse 13.5 (mobile), screenshots, Chrome DevTools Issues | PHASE_08 §5 | Performance, visual review |

## 2. How to run

```bash
npm run verify        # lint → typecheck → unit+integration → build → E2E (same as CI)
npm run lint
npm run typecheck     # next typegen && tsc --noEmit  (plain `npx tsc --noEmit` also works after `npm install`)
npm run test          # unit + integration
npm run build
npm run test:e2e      # needs a build; starts `npm run start` on port 3100 with test-only credentials
```
On this development machine, Playwright browsers live on D: (`PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright`) because C: is full. CI installs them normally (`.github/workflows/ci.yml`).

Device-specific E2E tests run in one project only (desktop- or phone-specific checks), so a run reports some tests as *skipped by design*.

## 3. Acceptance criteria → evidence

| # | Criterion (brief §19) | Automated evidence |
|---|---|---|
| 1 | Website builds successfully | `npm run build` (verify + CI) |
| 2 | TypeScript checks pass | `npm run typecheck`; fresh-clone `npx tsc --noEmit` works via `postinstall: next typegen` (Phase 9) |
| 3 | Lint checks pass | `npm run lint` |
| 4 | All public routes load correctly | `e2e/public-site.spec.ts` (9 routes × 2 devices: 200, one H1, title, phone link) |
| 5 | Navigation works on desktop and mobile | `e2e/public-site.spec.ts` (desktop nav `aria-current`; mobile menu open/navigate/Escape); `unit/navigation.test.tsx`; `e2e/admin-workflows.spec.ts` (admin phone menu) |
| 6 | Booking forms validate inputs correctly | `unit/booking-rules.test.ts` (schemas, phones, names, consent); `e2e/booking.spec.ts` (error summary, `aria-invalid`); `e2e/contact.spec.ts` |
| 7 | Invalid and past dates are rejected | `unit/slots.test.ts`; `integration/booking.test.ts` (past, inside notice, off-grid, closed day, holiday, out of window → 422); `e2e/booking.spec.ts` (past → 422) |
| 8 | Unavailable slots are rejected by the server | `integration/booking.test.ts` (taken → 409 with alternatives; blocked time → 409); `integration/admin-services.test.ts` |
| 9 | Concurrent bookings don't create conflicts | `integration/database.test.ts` (8 transactions → 1); `integration/booking.test.ts` (10 patients → 1 booking; capacity 2 → 2); `e2e/booking.spec.ts` (2 simultaneous HTTP → 201 + 409) |
| 10 | Duplicate submissions handled safely | `integration/booking.test.ts` (5 identical → 1); `integration/enquiries.test.ts`; `e2e/booking.spec.ts`, `e2e/contact.spec.ts` (replay → 200) |
| 11 | Booking references generated correctly | `unit/booking-rules.test.ts` (2,000 unique, format, normalisation); `e2e/booking.spec.ts` |
| 12 | Appointment records persist | `integration/booking.test.ts`; `e2e/admin.spec.ts` (book → confirm → status lookup) |
| 13 | Admin authentication works | `integration/auth.test.ts` (hash, sign-in, audit, disable, reset, last owner); `e2e/admin.spec.ts` (sign-in, wrong password, sign-out) |
| 14 | Unauthorised users can't access admin functionality | **`e2e/admin.spec.ts` route enumeration**: every admin API method → 401 anonymous, 403 staff on owner-only; page redirect; cross-site mutation → 403 |
| 15 | Status changes follow permitted transitions | `unit/booking-rules.test.ts` (transition table); `integration/booking.test.ts` (invalid → `INVALID_TRANSITION`, slot release); `e2e/admin.spec.ts` (confirm via UI) |
| 16 | Contact enquiries persist | `integration/enquiries.test.ts`; `e2e/contact.spec.ts`; `e2e/admin-workflows.spec.ts` (triage in admin) |
| 17 | Notification failures are recorded and recoverable | `integration/booking.test.ts` (provider down → booking kept, `failed` + retry → `sent`; permanent → `abandoned`; not configured → `skipped_not_configured`); `unit/notification-templates.test.ts`; `e2e/admin-workflows.spec.ts` (cron job with secret) |
| 18 | SEO metadata present and accurate | `e2e/seo.spec.ts` (unique titles and descriptions, canonical, OG/Twitter, OG image); `unit/seo.test.ts` |
| 19 | Sitemap and robots.txt correct | `e2e/seo.spec.ts`; `unit/seo.test.ts` (production rules) |
| 20 | Structured data uses verified information | `unit/seo.test.ts` (omits unverified fields; never ratings or prices); `e2e/seo.spec.ts` (Dentist, Breadcrumb, Service, FAQPage = visible FAQs) |
| 21 | Admin and private endpoints not publicly exposed | `e2e/admin.spec.ts`; `e2e/security.spec.ts` (`no-store`, `noindex`, bundle secret scan); `e2e/public-api.spec.ts` (no internal fields) |
| 22 | Responsive layouts at common sizes | `e2e/public-site.spec.ts` (no horizontal scroll at 360/390/768/1024/1280/1440; header fits at 1024); `e2e/admin-workflows.spec.ts` (admin at phone width); manual screenshots (Phases 2, 4–6) |
| 23 | Keyboard navigation and form accessibility | `e2e/keyboard.spec.ts` (visible focus, keyboard-only booking, reduced motion); axe on all public and admin pages (`public-site`, `admin` specs); Lighthouse a11y 100 |
| 24 | Production environment variables documented | `.env.example`; `docs/DEPLOYMENT.md` (Phase 10) |
| 25 | Deployment instructions complete | `docs/DEPLOYMENT.md` (Phase 10) |

## 4. Not automated (and why)

| Item | How it is checked |
|---|---|
| Real email delivery | Needs Resend + verified domain; manual delivery test at deployment (Phase 10) |
| HTTPS, HSTS, canonical-host redirect on the live domain | Production smoke test (Phase 10) |
| Atlas connectivity, backups | Deployment checklist (Phase 10) |
| Lighthouse / Core Web Vitals | Measured manually (PHASE_08 §5); field data via PageSpeed Insights after launch |
| Screen-reader experience | axe + semantic structure tested; a manual NVDA/TalkBack pass is recommended before launch |
| CI workflow | `.github/workflows/ci.yml` committed; it runs once the repository is on GitHub (not executed locally) |

## 5. Test data rules

- Sample opening hours (Mon–Sat 10:00–13:30, 16:00–20:00) exist **only** in the in-memory database, with a visible "sample data" banner.
- E2E credentials (`tests/e2e/credentials.ts`) are test-only constants used solely by the in-memory database wrapper.
- Each E2E test uses its own phone numbers and `X-Forwarded-For` values, so production rate limits stay switched on during tests.
