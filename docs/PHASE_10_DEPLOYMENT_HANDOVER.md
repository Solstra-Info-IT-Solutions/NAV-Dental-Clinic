# Phase 10 — Deployment and Handover

**Status:** Blocked on client accounts and decisions. All deployment preparation and handover documentation is done; **the site has not been deployed**, so nothing is *Verified in Production*.
**Date:** 2026-10-24

## 1. Objective and business value

Get the site live on the clinic's own domain and accounts, with backups, monitoring and clear instructions, so the clinic owns and can run its website without depending on any one person.

## 2. Files created or modified

| File | Purpose |
|---|---|
| `vercel.json` | Mumbai region (`bom1`); daily cron for notification retries (03:30 UTC = 09:00 IST, works on every plan; can be made hourly on paid plans) |
| `scripts/with-db.ts` | Refuses to start the in-memory test database on **any** Vercel build (including previews), so a missing `MONGODB_URI` fails the build instead of deploying sample data |
| `docs/DEPLOYMENT.md` | Atlas, Resend, Vercel, domain/HTTPS, environment variables per environment, first-time initialisation, smoke test, backups/restore, monitoring, maintenance, troubleshooting |
| `docs/CLIENT_HANDOVER.md` | Plain-language summary, accounts to own, inputs needed, first-week tasks, limitations, recommendations |
| `docs/PRODUCTION_READINESS_CHECKLIST.md` | Go-live checklist with current status per item |
| `docs/IMPLEMENTATION_STATUS.md` | Final project status |

## 3. Decisions

| Topic | Decision |
|---|---|
| Hosting | Vercel, functions in Mumbai (`bom1`); MongoDB Atlas in Mumbai (`ap-south-1`) |
| Environments | Production and Preview each have their own database (`nav_dental` / `nav_dental_staging`) and their own secrets; previews never send email and are never indexed |
| First data | `npm run db:init` once against production (empty hours, so booking stays closed until real hours are entered), then `npm run admin:create` for the owner |
| Retry job | Vercel Cron → `/api/cron/notifications` with `CRON_SECRET`; manual retry in admin |
| Backups | Atlas continuous backup (M10+), or a daily `mongodump` on the free tier; one test restore after launch |
| Monitoring | Vercel deployment and error logs, Atlas alerts, external uptime check, and the admin dashboard's failed-email warning |
| Ownership | All accounts in the clinic's name; the developer as a member |

## 4. Checks executed in this phase

| Command | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ 157 passed |
| `npm run build` (local, in-memory DB) | ✅ exit 0 |
| `vercel.json` | Parses as valid JSON; **not** validated by Vercel yet (first real deployment will confirm) |

No deployment, DNS, email delivery or production smoke test has been performed, because the accounts and domain don't exist yet.

## 5. Remaining steps to launch (in order)

1. The clinic provides the inputs in CLIENT_HANDOVER §3 (at minimum: opening hours, services, staff list, domain, emails, legal approval).
2. Create the accounts (GitHub, Vercel, Atlas, Resend) in the clinic's name.
3. Follow DEPLOYMENT.md §1–5.
4. Run the smoke test (DEPLOYMENT.md §6) and record the results here.
5. Search Console and Google Business Profile (SEO_STRATEGY.md §5–6).
6. Train the owner with ADMIN_GUIDE.md; sign off PRODUCTION_READINESS_CHECKLIST.md.
7. Update IMPLEMENTATION_STATUS.md to *Verified in Production* only for items actually checked live.

## 6. Completion checklist

- [x] Production configuration prepared (`vercel.json`, environment variable table, hosted-build safeguard)
- [x] Database initialisation and owner-creation instructions
- [x] Email (Resend) and DNS instructions
- [x] Domain and HTTPS instructions
- [x] Backup, restore, monitoring and maintenance documentation
- [x] Client handover guide and admin guide
- [x] Production readiness checklist
- [ ] Deployed
- [ ] Production functionality verified (smoke test)
- [ ] Email delivery verified
- [ ] Backups verified by a test restore
