# Client Handover — NAV Dental Clinic Website

A plain-language summary for Dr. Ratan Raghav and the clinic team.

## 1. What you are getting

| Part | What it does |
|---|---|
| **Public website** | Home, About, Services, Book an appointment, Contact, FAQ, Privacy Policy and Terms. Works on phones first; tap-to-call on every page. |
| **Online appointment requests** | Patients choose a visit type, date and a free time. The clinic **calls them to confirm** (they're told it isn't confirmed until then). Two people can never request the same time. Each request gets a reference like `NAV-K7Q2-M9XD-4T`. |
| **Request status page** | Patients check their request with the reference + their mobile number. |
| **Contact form** | Messages go to the clinic's admin area (not to anyone's personal inbox), with spam filtering. |
| **Admin area** (`/admin`) | Staff log in to confirm, move or cancel appointments, take phone bookings, block time, add holidays, answer enquiries, and (owner) change clinic details, opening hours, services and staff accounts. See **ADMIN_GUIDE.md**. |
| **Email notifications** | Staff alerts and patient emails, once the email service is set up. |
| **Search engine set-up** | Page titles and descriptions, Google-friendly clinic information, sitemap. Private pages are never shown in Google. |
| **Security and privacy** | Secure staff login, role-based access, audit log, data minimisation, retention tools. Details in SECURITY.md. |

## 2. Accounts the clinic should own

So the clinic stays in control, these accounts should be in the clinic's name (the developer can be added as a member):

1. **Domain** (registrar where the domain is bought)
2. **Vercel** (website hosting)
3. **MongoDB Atlas** (database, Mumbai region)
4. **Resend** (sending emails)
5. **GitHub** (the code)
6. **Google Business Profile** and **Google Search Console**

Keep the login details for these accounts safe, and turn on two-step verification wherever offered.

## 3. What we need from you before launch

| # | Item | Why |
|---|---|---|
| 1 | **Opening hours** (each day, breaks, weekly off-day) | Online booking stays closed until real hours are entered |
| 2 | **Appointment length and number of chairs** (proposed: 30 minutes, 1 chair, book at least 2 hours ahead, up to 30 days) | Controls the available times |
| 3 | **Which treatments the clinic offers** (and approval of the wording for each) | Only confirmed services are published |
| 4 | **Doctor's qualifications and dental council registration number** (as on the certificate) | Shown on the website only once provided |
| 5 | **Is 8006606001 on WhatsApp?** | WhatsApp buttons stay hidden until you confirm |
| 6 | **Clinic email address** and **staff alert email(s)** | Contact details and new-booking alerts |
| 7 | **Domain name** and access to its DNS settings | Needed to go live and send email |
| 8 | **Vector logo file** (SVG, AI, EPS or PDF) | The current logo on the site is a temporary tracing of the image provided |
| 9 | **Real photographs** (clinic outside, reception, treatment room, doctor) | No stock photos are presented as the clinic |
| 10 | **Exact Google Maps location** (share link) and **PIN code** | Accurate directions and Google listing |
| 11 | **Confirm "BSR"** means Bulandshahr | Used consistently in the address and for Google |
| 12 | **Approval of the Privacy Policy and Terms** (drafts on the site) | They are marked "Draft" and hidden from Google until approved |
| 13 | **How long to keep records** (proposed: appointments 24 months, enquiries 12 months) | Old records are deleted after this period |
| 14 | **Cancellation policy** wording | FAQ and Terms |
| 15 | **Who needs staff accounts**, and who is the owner | Each person gets their own login |
| 16 | **Two-step login for the owner?** (recommended) | Extra protection for the account that can change everything |

We recommend the clinic asks a qualified adviser to review its responsibilities under India's Digital Personal Data Protection Act, 2023. The website was built to support good privacy practice, but it doesn't certify legal compliance.

## 4. Your first week after launch

1. Sign in to `/admin` with the owner account and change the temporary password if one was given.
2. **Clinic settings:** enter opening hours, staff alert emails, WhatsApp choice, qualifications and map link; tick the legal approval box once approved.
3. **Services:** publish only treatments the clinic offers.
4. **Staff accounts:** create an account for each team member (never share logins).
5. Make a test booking with your own mobile and check you receive the staff alert.
6. Set up your **Google Business Profile** with exactly the same name, address and phone as the website, and add the website link.
7. Ask genuine patients for Google reviews. Never write or buy reviews, and don't copy reviews onto the website.

## 5. Day-to-day use

See **ADMIN_GUIDE.md**. In short: check the dashboard every morning, call and confirm pending requests, mark visits completed or no-show, and reply to enquiries.

## 6. Limitations to know about

- Online requests aren't confirmed bookings until the clinic calls the patient (by design; it can be switched to instant booking in settings).
- Patients cancel or move appointments by phone; there is no online self-service yet.
- Staff password resets are done by the owner in the admin area. "Forgot password" emails need the email service, and can be added later.
- Two-step login isn't switched on yet.
- No SMS or WhatsApp messages are sent automatically. That needs a WhatsApp Business API provider, approved message templates and patient consent.
- No website analytics are installed. If you want them, the Privacy Policy must be updated first.
- Hindi pages aren't built yet, but the site is prepared for them.
- On slow phones the booking page takes a little longer to become interactive than other pages. It will be re-measured with real-visitor data after launch.

## 7. Recommendations for later

1. Turn on two-step login for the owner.
2. Add email-based password reset once email is working.
3. Add Hindi versions of the key pages.
4. Add real clinic photographs and the vector logo.
5. Review website speed after a month of real visitor data.
6. Consider WhatsApp or SMS reminders once a provider and consent process are in place.

## 8. Where everything is documented

| Document | For |
|---|---|
| ADMIN_GUIDE.md | Clinic staff |
| DEPLOYMENT.md | The developer (hosting, database, email, domain, backups, monitoring) |
| PRODUCTION_READINESS_CHECKLIST.md | Go-live sign-off |
| SECURITY.md | Security and privacy design |
| SEO_STRATEGY.md | Google and local search |
| TEST_PLAN.md | How the system is tested |
| IMPLEMENTATION_STATUS.md | Overall progress |
