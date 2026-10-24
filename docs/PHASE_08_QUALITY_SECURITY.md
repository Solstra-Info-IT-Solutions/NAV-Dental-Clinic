# Phase 8 — Security, Accessibility and Performance

**Status:** Tested (local production build; production-only controls verified at deployment)
**Date:** 2026-10-24

## 1. Objective and business value

Before launch, review and harden security across the whole site, prove accessibility for keyboard and assistive-technology users, and measure real performance on mobile, fixing what is safe to fix and reporting the rest honestly.

## 2. Files created or modified

| Area | Files |
|---|---|
| Headers / CSP / HSTS | `src/lib/security/headers.ts` (new), `next.config.ts` |
| CSP compatibility | `src/features/appointments/schemas.ts` (`z.config({ jitless: true })`) |
| Data retention | `src/features/retention/service.ts`, `scripts/db-purge.ts`, `package.json` (`db:purge`) |
| Performance | `src/app/(public)/page.tsx` (hero image `loading="eager"`) |
| Tests | `tests/e2e/security.spec.ts`, `tests/e2e/keyboard.spec.ts`, `tests/integration/retention.test.ts` |
| Docs | `docs/SECURITY.md` (final), this file, `IMPLEMENTATION_STATUS.md`, `README.md` |

## 3. Security review

Reviewed every public and admin route, the auth flow, data handling and dependencies against the threat table in SECURITY.md §3. New in this phase:

1. **Content-Security-Policy** and the remaining headers (COOP, extended Permissions-Policy, HSTS on HTTPS).
   - **Experiment:** a nonce CSP is incompatible with Partial Prerendering. A strict `script-src 'self'` with SRI blocked 29 inline Next.js scripts and broke the site.
   - **Decision:** `'unsafe-inline'` for scripts, never `eval` in production, everything else strict. This is documented as an accepted risk with mitigations (SECURITY.md §4).
2. **Zod eval probe:** Zod 4 tried `new Function` in the browser and was blocked by the CSP, which showed up in Chrome's Issues panel. Zod now runs `jitless`, and DevTools reports no CSP issues on the home, booking, contact or sign-in pages.
3. **Data retention:** `npm run db:purge` (dry run by default, `--apply` to delete) removes appointments ended and enquiries received before the owner's retention periods, with related holds and notification records, and audits counts only.
4. **Bundle secret scan** (automated E2E): no secret names, connection strings, Mongoose or auth adapter code in browser JavaScript.
5. **Repository secret scan:** `git grep` for password/secret/API-key assignments is clean. Only labelled test-only credentials exist under `tests/`.
6. **Dependency audit:** `npm audit` reports 0 vulnerabilities for all dependencies, including dev tooling (the Phase 2 ESLint advisories no longer apply).

## 4. Accessibility

| Check | Result |
|---|---|
| axe-core WCAG 2.2 AA (all 9 public pages × desktop + mobile; sign-in + 10 admin screens) | No serious or critical violations |
| Lighthouse accessibility (5 key pages, mobile) | **100** on every page |
| Keyboard: every focusable element on `/`, `/appointment`, `/contact` shows a visible focus indicator (first 45 tab stops) | Pass |
| Keyboard-only booking (select date and time with Space, type details, submit with Enter, focus moves to the confirmation heading) | Pass |
| `prefers-reduced-motion: reduce` disables transitions | Pass |
| Mobile menu: Escape closes and returns focus; skip link moves focus to main | Pass (Phase 2 tests) |
| Error summaries focused, fields with `aria-invalid` + described-by messages | Pass (Phase 4–6 tests) |

## 5. Performance (measured, not estimated)

Lighthouse 13.5.0, mobile preset with simulated 4× CPU / slow 4G throttling, installed Chrome 145 headless, production build served locally, this machine's benchmark index ≈ 1,250. The local build is deliberately `noindex`, so the SEO score is held down only by the *is-crawlable* audit; it should be 100 in production.

| Page | Performance | Accessibility | Best practices | SEO (local) | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 87 | 100 | 100 | 69* | 1.1 s | 2.8 s | 380 ms | 0 |
| `/appointment` | 69 | 100 | 100 | 66* | 0.8 s | 3.0 s | 1,396 ms | 0 |
| `/contact` | 84 | 100 | 100 | 66* | 0.9 s | 1.9 s | 620 ms | 0 |
| `/faq` | 84 | 100 | 100 | 66* | 0.8 s | 2.8 s | 468 ms | 0 |
| `/services/dental-consultation` | 81 | 100 | 100 | 66* | 0.9 s | 2.9 s | 546 ms | 0 |

\* Only failing SEO audit: *Page is blocked from indexing* (intentional outside production).

Observations:
- **TBT varies widely between runs on this machine.** Two baseline runs of the service page gave 170 ms and 329 ms (scores 94 and 88). Treat single numbers as indicative.
- **Zero layout shift** everywhere: fonts have size-adjusted fallbacks and images have dimensions.
- **Code-splitting works:** form libraries (React Hook Form + Zod, about 43 KB gzipped) load only on pages with forms. About 156 KB gzipped of the shared JavaScript is the React/Next runtime; the polyfill chunk is `noModule` and skipped by modern browsers.
- **Fonts aren't the LCP bottleneck.** Switching both fonts to `display: optional` didn't change LCP (2.85 s), so it was reverted to keep the brand typography.
- **Fixed:** the above-the-fold hero image was lazy-loaded (Chrome issue); it is now loaded eagerly with high priority.
- **Main remaining item:** booking-page blocking time (form hydration and validation code). Options for a later pass: lighter client validation (e.g. `zod/mini`), or deferring part of the form's JavaScript. Re-measure with PageSpeed Insights field data after deployment before deciding.

## 6. Checks executed

| Command | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ 16 files, **150 tests passed** |
| `npm run build` | ✅ exit 0 |
| `npx playwright test` | ✅ **116 passed**, 40 skipped by design (device-specific) |
| `npm audit` / `npm audit --omit=dev` | ✅ 0 vulnerabilities / 0 vulnerabilities |
| Lighthouse 13.5.0 (mobile) on 5 pages | See §5 |
| Chrome DevTools Issues (CDP) on `/`, `/appointment`, `/contact`, `/admin/login` | No issues after fixes |

## 7. Known issues / limitations

- `script-src 'unsafe-inline'` (accepted risk, SECURITY.md §4).
- HSTS and `upgrade-insecure-requests` only apply on the HTTPS production domain (to verify at deployment); no HSTS `preload` until confirmed.
- Lighthouse couldn't trace the home page with Playwright's Chromium build (`NO_NAVSTART`); the installed Chrome was used instead (temporary profile on D:, the user's profile untouched).
- Booking page TBT (see §5); real-user metrics to be checked after launch.
- Turnstile not added: current spam layers are adequate for a local clinic. Add Turnstile (and allow `challenges.cloudflare.com` in the CSP) if spam appears in production.
- 2FA and email password reset still pending (Phase 6).

## 8. Completion checklist

- [x] Security review of inputs, routes, auth and data handling
- [x] CSP and security headers; HSTS for HTTPS
- [x] Request size limits, safe errors, injection and CSV protections verified
- [x] Secret scanning (repository and browser bundle); dependency audit
- [x] Data minimisation and retention tooling
- [x] Accessibility: axe, keyboard, focus, reduced motion, Lighthouse a11y 100
- [x] Performance measured and safe optimisations applied; remaining items documented
- [ ] Production verification of HTTPS/HSTS/canonical redirect (Phase 10)

## 9. External inputs required

- Decision on two-factor authentication for the owner account.
- Confirmation of retention periods (to enable scheduled purging).
- Production secrets at deployment (`BETTER_AUTH_SECRET`, `RATE_LIMIT_SALT`, `CRON_SECRET`).
