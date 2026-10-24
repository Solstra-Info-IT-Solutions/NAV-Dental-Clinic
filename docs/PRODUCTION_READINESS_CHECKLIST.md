# Production Readiness Checklist

Legend: ✅ done and verified locally · ⏳ pending client input · 🚀 pending deployment (verify on the live site) · ⬜ not started

_Last updated: 2026-10-24. Nothing is marked "verified in production" because the site has not been deployed._

## 1. Code and quality

| Item | Status | Evidence |
|---|---|---|
| Build succeeds | ✅ | `npm run build` |
| TypeScript strict passes | ✅ | `npm run typecheck`; fresh-clone `npx tsc --noEmit` |
| Lint passes | ✅ | `npm run lint` |
| Unit + integration tests | ✅ | 157/157 |
| End-to-end tests (desktop + phone) | ✅ | 121 passed, 0 failed |
| CI on GitHub | 🚀 | `.github/workflows/ci.yml`; runs on the first push |
| Dependency audit | ✅ | `npm audit`: 0 vulnerabilities (2026-10-24) |
| No secrets in repository or browser bundle | ✅ | git grep scan; E2E bundle scan |

## 2. Content and business details

| Item | Status |
|---|---|
| Clinic name, doctor, phone, address on every page (consistent) | ✅ |
| Real opening hours entered in Clinic settings | ⏳ |
| Appointment length, chairs, notice, booking window confirmed | ⏳ (defaults: 30 min, 1 chair, 2 h, 30 days) |
| Services confirmed and copy approved; unconfirmed services unpublished | ⏳ (only Dental Consultation published) |
| Doctor qualifications and registration number | ⏳ |
| WhatsApp availability confirmed | ⏳ (buttons hidden) |
| Clinic email and staff alert emails | ⏳ |
| "BSR" confirmed (Bulandshahr?) | ⏳ |
| Map pin and PIN code | ⏳ |
| Vector logo (replace provisional tracing) | ⏳ |
| Real photographs | ⏳ |
| Privacy Policy and Terms reviewed and approved (toggle in settings) | ⏳ |
| Cancellation policy wording | ⏳ |
| Retention periods confirmed | ⏳ (proposed 24 / 12 months) |
| No fake reviews, statistics, credentials or claims | ✅ |

## 3. Booking system

| Item | Status |
|---|---|
| Server-side validation and slot re-validation | ✅ |
| No double booking under concurrency | ✅ |
| Idempotent submissions; non-guessable references | ✅ |
| Request mode (staff confirm) as default; honest wording | ✅ |
| Status machine; cancellation releases slots | ✅ |
| Notifications recorded, retryable; cron job | ✅ (locally) / 🚀 cron on Vercel |
| Real email delivery (staff + patient) | 🚀 needs Resend + verified domain |

## 4. Admin and security

| Item | Status |
|---|---|
| No public sign-up; owner created with `admin:create` | ✅ / 🚀 run against production |
| Every admin endpoint returns 401/403 correctly | ✅ |
| Staff accounts created for each person | ⏳ list needed |
| Two-factor login for owner | ⏳ client decision |
| Production secrets generated and stored only in Vercel | 🚀 |
| HTTPS, HSTS, CSP and security headers on the live domain | 🚀 (headers verified locally) |
| Canonical host redirect (`*.vercel.app` → domain) | 🚀 |
| Atlas user least-privilege, network access configured | 🚀 |
| Backups enabled and one restore tested | 🚀 |
| Monitoring: Vercel notifications, Atlas alerts, uptime check | 🚀 |

## 5. SEO

| Item | Status |
|---|---|
| Unique titles and descriptions, canonical, OG/Twitter, share image | ✅ |
| robots.txt and sitemap.xml; private and draft pages excluded | ✅ |
| Indexable only on production domain | ✅ (logic) / 🚀 verify live |
| Structured data valid (Rich Results Test on live URLs) | 🚀 |
| Google Search Console verified; sitemap submitted | 🚀 |
| Google Business Profile matches website NAP | ⏳ |

## 6. Accessibility and performance

| Item | Status |
|---|---|
| axe WCAG 2.2 AA: no serious/critical issues (public + admin) | ✅ |
| Keyboard-only use, visible focus, reduced motion | ✅ |
| Lighthouse accessibility 100 (mobile) | ✅ |
| Manual screen-reader pass (NVDA / TalkBack) | ⬜ recommended before launch |
| Performance measured (mobile) | ✅ 69–87 locally; 🚀 re-measure live (PageSpeed Insights) |

## 7. Go-live sign-off

| Step | Status |
|---|---|
| All ⏳ items above resolved or explicitly accepted by the clinic | ⏳ |
| Smoke test in DEPLOYMENT.md §6 completed and recorded | 🚀 |
| Clinic owner trained on the admin area (ADMIN_GUIDE.md) | ⬜ |
| Clinic owns all accounts (domain, Vercel, Atlas, Resend, GitHub) | ⏳ |
| Launch approved by the clinic | ⬜ |
