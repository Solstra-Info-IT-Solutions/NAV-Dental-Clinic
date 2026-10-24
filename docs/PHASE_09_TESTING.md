# Phase 9 — Automated and Manual Testing

**Status:** Tested (full clean local run; CI workflow not yet executed on GitHub)
**Date:** 2026-10-24

## 1. Objective and business value

Prove, in one repeatable run, that every acceptance criterion in the brief holds, and close the gaps before deployment. The clinic gets a site whose booking rules, security and accessibility are checked automatically on every change, not just once.

## 2. Files created or modified

| Area | Files |
|---|---|
| Test plan | `docs/TEST_PLAN.md` (acceptance criteria → evidence, how to run, what is not automated) |
| New tests | `tests/unit/notification-templates.test.ts`, `tests/e2e/admin-workflows.spec.ts` |
| Test support | `tests/e2e/credentials.ts` (test-only cron secret), `playwright.config.ts` (passes it to the test server) |
| Tooling | `package.json` (`postinstall: next typegen`, `verify`), `.github/workflows/ci.yml` |
| Bug fix | `src/components/admin/ui.tsx` (`min-w-0` on panels) |
| Docs | this file, `IMPLEMENTATION_STATUS.md` |

## 3. Gaps found and closed

| Gap | Action |
|---|---|
| Email wording only tested for "request received" | Tests for all five patient events plus instant booking and the staff alert (IST time, reference, clinic phone, no patient phone echoed back) |
| Settings validation only tested at service level | E2E through the real API: overlapping hours and a bad phone → 422 with field paths; a stale version → 409 `VERSION_CONFLICT` |
| Enquiry management not exercised end to end | E2E: website message → listed with masked phone → status and note via admin API → detail shows both |
| Cron retry job only tested for 401 | E2E with the test-only secret → 200 with counts; a wrong secret → 401 |
| Unknown records in admin API | E2E: unknown and malformed ids → standard 404 envelope |
| Admin at phone width untested | E2E at Pixel 7 size: six admin screens fit without sideways scrolling; the menu works |
| `npx tsc --noEmit` failed on a fresh clone | Reproduced (missing generated route types); fixed with `postinstall: next typegen` and re-verified |
| No single "run everything" command | `npm run verify` (lint → typecheck → unit/integration → build → E2E); same steps in CI |

## 4. Bug found by the full run

**Admin dashboard overflowed sideways on phones when it had data** (288 px). The wide appointments table sat in a grid cell, and grid cells grow to fit their content by default, so the table's minimum width widened the page instead of scrolling inside its panel. The phone test passed on its own (empty dashboard) and failed in the full run (earlier tests had created appointments). Fixed with `min-w-0` on admin panels. The test now creates its own appointment, so it no longer depends on test order.

## 5. Checks executed (final run, 2026-10-24)

| Command | Result |
|---|---|
| `npm run verify`: lint | ✅ exit 0 |
| `npm run verify`: typecheck | ✅ exit 0 |
| `npm run verify`: unit + integration | ✅ 17 files, **157 tests passed** |
| `npm run verify`: build | ✅ exit 0 |
| `npm run verify`: E2E (first clean run) | ❌ 120 passed, **1 failed** (the phone-overflow bug above) |
| After the fix: lint, `npx tsc --noEmit`, build, `npx playwright test` | ✅ **121 passed, 0 failed**, 45 skipped by design |
| Fresh-clone simulation (`.next` removed): `npx tsc --noEmit` | ❌ before fix → ✅ after `npm run postinstall` |

"Skipped by design" means tests that apply to only one device project (e.g. API and header checks run once on desktop; phone-layout checks run only on the phone).

Totals across the project: **157 unit/integration tests** and **121 end-to-end checks** (desktop + phone), plus measured Lighthouse results (PHASE_08 §5).

## 6. Known issues / limitations

- The CI workflow hasn't run yet (no GitHub remote). It should be checked on the first push.
- Not automatable here: real email delivery, the live HTTPS domain (HSTS, canonical redirect), Atlas backups, and a manual screen-reader pass (NVDA/TalkBack). All are listed in TEST_PLAN §4 and planned for Phase 10.
- E2E on this machine needs `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright` (C: drive full).

## 7. Completion checklist

- [x] Unit tests
- [x] Integration tests on a real MongoDB replica set
- [x] End-to-end tests (desktop + phone)
- [x] Booking conflict and duplicate tests
- [x] Admin authorisation tests (route enumeration)
- [x] Mobile responsiveness tests (public + admin)
- [x] Form error and success tests
- [x] SEO checks
- [x] Production build verification
- [x] Acceptance criteria mapped to evidence (TEST_PLAN.md)
- [ ] CI run on GitHub (after the repository is pushed)
- [ ] Production smoke tests (Phase 10)
