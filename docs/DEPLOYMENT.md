# Deployment Guide — NAV Dental Clinic

Step-by-step production setup: **Vercel** (hosting, Mumbai region), **MongoDB Atlas** (database, Mumbai), **Resend** (email) and the clinic's **domain**. Written for the developer doing the launch; the clinic owner's part is in CLIENT_HANDOVER.md.

> Status: **not yet deployed.** Every step below must be done and checked before anything is marked *Verified in Production*.

## 0. Before you start

| You need | Who provides |
|---|---|
| A GitHub repository (private) for the code | Developer (clinic should be added as owner or collaborator) |
| Vercel account (team owned by, or transferable to, the clinic) | Clinic |
| MongoDB Atlas account | Clinic |
| Resend account | Clinic |
| The domain and access to its DNS settings | Clinic |
| Confirmed opening hours, services, staff list and the owner's email | Clinic |

**Plans and costs:** check each provider's current pricing and terms. Vercel's free *Hobby* plan is for personal, non-commercial use, so a clinic website will normally need a paid plan. Atlas's free tier has no automated backups (see §7). Nothing in this project requires a paid add-on beyond that.

## 1. Push the code to GitHub

```bash
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```
The CI workflow (`.github/workflows/ci.yml`) runs on the first push. It must pass (green) before you continue. It uses only throwaway data and needs no secrets.

## 2. MongoDB Atlas

1. Create a project, e.g. *NAV Dental Clinic*.
2. Create a cluster in **AWS Mumbai (`ap-south-1`)**. A dedicated tier (M10+) is recommended for continuous backups. M0 (free) works but has no automated backups (§7).
3. **Database access:** create a user `nav-app` with a long generated password and the role **readWrite on database `nav_dental` only**.
4. **Network access:** Vercel functions have no fixed IPs on most plans. Allow `0.0.0.0/0` (protected by the strong password and TLS), or use Vercel's MongoDB Atlas integration / private networking if your plan supports it.
5. Copy the connection string (`mongodb+srv://nav-app:<password>@<cluster>/?retryWrites=true&w=majority`). This is `MONGODB_URI`.
6. Create a **separate database or cluster for previews/staging** (e.g. `nav_dental_staging`). Never point previews at production data.

Initialise the production database **once**, from your machine:
```bash
# PowerShell: $env:MONGODB_URI="mongodb+srv://..."; npm run db:init
MONGODB_URI="mongodb+srv://..." MONGODB_DB="nav_dental" npm run db:init
MONGODB_URI="mongodb+srv://..." MONGODB_DB="nav_dental" npm run admin:create -- --email <owner-email> --name "Dr. Ratan Raghav" --role owner
```
`db:init` creates collections and indexes and seeds settings (with **empty** opening hours, so online booking stays closed until real hours are entered) and services (only *Dental Consultation* published). It is safe to re-run. `admin:create` asks for the password with hidden input.

## 3. Resend (email)

1. Add the sending domain (e.g. `mail.<clinic-domain>` or the root domain) in Resend.
2. Add the DNS records Resend shows (SPF, DKIM, and optionally DMARC) at the domain's DNS provider; wait for **Verified**.
3. Create an API key with **sending access only**. This is `RESEND_API_KEY`.
4. Choose the sender, e.g. `EMAIL_FROM="NAV Dental Clinic <appointments@<clinic-domain>>"`.

Until this is done the site works normally, but notifications are recorded as *Email not set up* and are not sent.

## 4. Vercel project

1. **Add New → Project →** import the GitHub repository. The framework is detected as Next.js; keep the default build command (`npm run build`) and install command.
2. **Settings → Functions → Region:** Mumbai (`bom1`). This is also set in `vercel.json`.
3. **Environment variables** (Production and Preview separately):

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<clinic-domain>` | the preview URL or a staging domain | No trailing slash. Drives canonical URLs, sitemap and the indexing decision |
| `MONGODB_URI` | production Atlas URI | **staging** Atlas URI | Required for every build (builds read settings and services) |
| `MONGODB_DB` | `nav_dental` | `nav_dental_staging` | |
| `BETTER_AUTH_SECRET` | 32+ random characters | different value | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://<clinic-domain>` | preview/staging URL | |
| `RATE_LIMIT_SALT` | 24+ random characters | different value | |
| `CRON_SECRET` | 24+ random characters | optional | Vercel Cron sends it automatically as a Bearer token |
| `RESEND_API_KEY` | from §3 | leave empty (no emails from previews) | |
| `EMAIL_FROM` | from §3 | — | |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | token from Search Console (optional) | — | |
| `SITE_INDEXING` | leave unset | leave unset (previews are never indexed) | `off`/`on` override only if needed |
| `MONGOMS_DISABLE_POSTINSTALL` | `1` | `1` | Skips downloading the test-only MongoDB binary during install |

Never put real secrets in the repository or in `NEXT_PUBLIC_*` variables. Hosted builds refuse to start the in-memory test database (`scripts/with-db.ts`), so a missing `MONGODB_URI` fails the build instead of deploying sample data.

4. **Deploy.** The build log must show no errors.

## 5. Domain and HTTPS

1. **Vercel → Settings → Domains:** add `<clinic-domain>` and `www.<clinic-domain>`, and choose one as primary (the other redirects).
2. At the DNS provider, add the records Vercel shows (A/ALIAS for the apex, CNAME for `www`). HTTPS certificates are issued automatically.
3. Make sure `NEXT_PUBLIC_SITE_URL` exactly matches the primary domain, then redeploy. The app also redirects any other host (e.g. `*.vercel.app`) to it with a 308.
4. HSTS (`max-age` 2 years, `includeSubDomains`) is sent automatically on HTTPS. Do **not** add `preload` unless the clinic confirms every subdomain will always be HTTPS.

## 6. Production smoke test (do all, record results in PHASE_10)

| # | Check | Expected |
|---|---|---|
| 1 | Open `https://<domain>/` on a phone | Loads with the logo and the phone/WhatsApp buttons; no "sample data" banner |
| 2 | `curl -I https://<domain>/` | 200; `strict-transport-security`, `content-security-policy`, `x-frame-options: DENY`; **no** `x-robots-tag: noindex` |
| 3 | `https://<project>.vercel.app/` | 308 redirect to the domain |
| 4 | `/robots.txt`, `/sitemap.xml` | robots allows `/` and lists the sitemap; sitemap has the live domain URLs |
| 5 | `/admin` | Redirects to sign-in; owner can sign in; **Clinic settings**: enter real opening hours, staff alert emails, WhatsApp switch, approved details |
| 6 | Booking (after hours are saved) | Request a test appointment with your own mobile and email; reference shown |
| 7 | Email delivery | Staff alert and patient acknowledgement arrive (check spam); the admin **Notifications** screen shows *Sent* |
| 8 | Admin | Confirm, then cancel the test booking; the slot becomes free again; status lookup shows *Cancelled* |
| 9 | Contact form | Send a test message; it appears under **Enquiries**; staff alert arrives |
| 10 | Cron | Vercel → Settings → Cron Jobs shows `/api/cron/notifications`; *Run* returns 200 |
| 11 | Structured data | Google Rich Results Test on `/`, `/contact`, `/faq`, a service page: valid, no errors |
| 12 | Lighthouse / PageSpeed Insights (mobile) | Record scores; SEO should now be 100 |
| 13 | Clean up | Delete or mark the test appointment/enquiry as resolved |

## 7. Backups and recovery

- **Atlas M10+:** enable **Continuous Cloud Backup** (point-in-time restore). Test a restore to a temporary cluster once after launch.
- **Atlas M0 (free):** no automated backups. Schedule a `mongodump` at least daily from a trusted machine and store the archive encrypted, off-site, with restricted access:
  ```bash
  mongodump --uri="$MONGODB_URI" --db=nav_dental --archive=nav-$(date +%F).gz --gzip
  mongorestore --uri="$RESTORE_URI" --archive=nav-YYYY-MM-DD.gz --gzip --nsInclude="nav_dental.*"
  ```
- Backups contain personal data: delete old archives in line with the retention policy.
- Code is in GitHub; any earlier deployment can be restored with **Vercel → Deployments → Promote/Rollback**.

## 8. Monitoring

- **Vercel:** enable deployment notifications; check *Logs* for `"level":"error"` entries (JSON logs; personal data redacted).
- **Atlas:** enable alerts for connections, disk and replication lag; add the developer's and the clinic's email.
- **Uptime:** add an external uptime check on `https://<domain>/` and `/api/public/settings` (any monitoring service; 5-minute interval).
- **Admin dashboard:** the *Notifications* warning shows failed emails. Staff should look at the dashboard daily.
- Optional: Sentry or another error tracker. If added, update the CSP `connect-src` and the Privacy Policy.

## 9. Routine maintenance

| When | Task |
|---|---|
| Weekly | Check the dashboard for failed notifications; look at Spam enquiries |
| Monthly | `npm outdated` / `npm audit`; update Next.js, Better Auth and Mongoose patch versions in a branch; CI must pass before merging |
| Monthly (once retention is approved) | `npm run db:purge` (dry run), then `npm run db:purge -- --apply` against production |
| On staff changes | Disable leavers in **Staff accounts**; rotate shared secrets if anyone had access |
| Yearly | Review the Privacy Policy and Terms with the clinic; renew the domain |

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Build fails: "MONGODB_URI must be set for hosted builds" | Add `MONGODB_URI` for that environment (Preview needs its own) |
| Build fails connecting to Atlas | Atlas network access doesn't allow Vercel; check the IP list, user and password |
| Online booking says "not available yet" | No opening hours saved in Clinic settings, or online booking switched off |
| Emails show *Email not set up* | `RESEND_API_KEY`/`EMAIL_FROM` missing in Production; redeploy after adding |
| Emails *Failed* | Domain not verified in Resend or the API key revoked; fix, then **Retry** in Notifications |
| Sign-in "too many attempts" | Wait 15 minutes (rate limit by IP) |
| Site shows `noindex` in production | `NEXT_PUBLIC_SITE_URL` isn't `https://<real domain>`, or `SITE_INDEXING=off` is set |
| Changes in settings not on the website | Public pages refresh on save; hard-refresh the browser. If still stale, redeploy |
