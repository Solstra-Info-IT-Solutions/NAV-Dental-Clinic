# SEO Strategy — NAV Dental Clinic

**Goal:** help people in and around Pahasu who are looking for a dentist find the clinic and book or call. The approach is honest, local and lean: a few genuinely useful pages, consistent clinic details, and no thin "dentist in every nearby village" pages.

## 1. Principles

1. **Verified facts only.** Name, address, phone, doctor, services, hours and credentials come from Clinic settings. Unverified details (hours, map pin, qualifications, reviews) are left out of pages and structured data until the clinic confirms them.
2. **One canonical site.** Only the production HTTPS domain is indexable. Previews, staging and local builds send `noindex` and a blocking `robots.txt`. In production, other hosts (for example `*.vercel.app`) redirect permanently (308) to the canonical domain.
3. **Consistent NAP.** Clinic name, address and phone are identical everywhere: header, footer, contact page, structured data and the Google Business Profile.
4. **No keyword stuffing,** no doorway pages, no fake reviews, ratings, statistics or before/after claims.

## 2. Page → keyword map

Search intent and the primary/secondary phrases each page is written for. Copy uses these naturally, in plain language.

| Page | Primary intent / phrase | Secondary phrases | Title (≤ 60) |
|---|---|---|---|
| `/` | dentist Pahasu; dental clinic Pahasu | Dr. Ratan Raghav; dental clinic Somna Road; dentist near Tata Kishan Kendra; dentist Bulandshahr district* | NAV Dental Clinic, Pahasu \| Dr. Ratan Raghav (owner-editable) |
| `/about` | Dr. Ratan Raghav dentist | NAV Dental Clinic about; dentist Pahasu | About Dr. Ratan Raghav and the Clinic |
| `/services` | dental services Pahasu | dental treatment Pahasu; dental check-up | Dental Services |
| `/services/dental-consultation` | dental check-up Pahasu; dental consultation Pahasu | toothache dentist Pahasu; tooth pain check | Dental Consultation in Pahasu (per-service override in admin) |
| `/services/{other}` (once confirmed) | "{treatment} in Pahasu" e.g. root canal treatment Pahasu | treatment-specific questions | {Treatment} in Pahasu |
| `/appointment` | book dentist appointment Pahasu | dentist appointment online | Book a Dental Appointment |
| `/contact` | NAV Dental Clinic contact; dentist Pahasu phone number | directions, Somna Road Pahasu | Contact and Directions |
| `/faq` | how to book / reschedule a dentist appointment | clinic location, confirmation | Frequently Asked Questions |

\* Use "Bulandshahr" in copy only after the clinic confirms that "BSR" means Bulandshahr (open question in PHASE_00 §3).

Every title gets the suffix "| NAV Dental Clinic, Pahasu" (except the home page). Descriptions are unique, 120–160 characters, and mention the phone number or the booking action.

## 3. Internal linking

- Header and footer link to every main page; the footer repeats the full NAP block.
- Home → Services (cards), About, Appointment, Contact, FAQ.
- Every service page → *More information*: up to 3 other published services, All services, Appointment FAQs, Find the clinic; plus a booking panel (call or request).
- Services index → each service (card titles are links).
- Breadcrumbs on all inner pages (visual + `BreadcrumbList` structured data).
- Renamed services keep their old address through a permanent redirect (`redirectFrom`), so external links never break.

## 4. Technical implementation (Phase 7)

| Item | Where |
|---|---|
| Unique title/description, canonical URL, Open Graph, Twitter card | `src/lib/seo/metadata.ts` → every public page |
| Owner-editable home title/description | Admin → Clinic settings → *Search engines* |
| Per-service search title/description | Admin → Services → edit |
| Social share image (1200×630, brand palette) | `src/app/opengraph-image.tsx` |
| `robots.txt` | `src/app/robots.ts` (production: allow all except `/admin`, `/api`, `/appointment/status`; otherwise disallow all) |
| `sitemap.xml` | `src/app/sitemap.ts` (public pages + published services; legal pages only after approval) |
| `noindex` header on non-production and private areas | `next.config.ts` |
| Canonical host redirect | `src/proxy.ts` |
| Structured data | `src/lib/seo/structured-data.ts`: `Dentist` (home, contact), `WebSite` (home), `BreadcrumbList` (inner pages), `Service` (service pages), `FAQPage` (FAQ page only) |
| Search Console verification | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` env var → `<meta name="google-site-verification">` |

**Structured data rules:** `openingHoursSpecification` appears only once hours are entered; `geo` only once a verified map pin is entered; `sameAs` only for configured social profiles or map links; `email` only if configured. **Never** `aggregateRating`, `review`, `priceRange`, awards or medical claims. FAQPage markup is limited to the clinic's own FAQ page. Since 2023 Google shows FAQ rich results only for well-known authoritative health and government sites, so this markup is descriptive and no rich result is expected.

## 5. Local SEO checklist (needs the clinic)

1. **Google Business Profile (GBP):** claim or verify the clinic's profile (business.google.com) with the exact name *NAV Dental Clinic*, category *Dentist* (primary) / *Dental clinic*, the same address and phone as the website, and the website URL. Add real photos of the clinic exterior, reception and treatment room. Add confirmed opening hours (and update holiday hours).
2. Paste the GBP share link into **Clinic settings → Google Business Profile link**, and the map pin share link into **Google Maps link**.
3. Ask genuine patients for reviews **on Google**. Never write, buy or incentivise reviews, and do not copy reviews onto the website.
4. Keep NAP identical on any directory listings (Justdial, Practo, Facebook page, etc.) the clinic chooses to use. Add those profile URLs under Social links so they appear in `sameAs`.
5. If the clinic has a PIN code, add it in settings (it is added to the address everywhere).

## 6. Search Console setup (after domain + deployment)

1. Set `NEXT_PUBLIC_SITE_URL=https://<domain>` in production (no trailing slash) and deploy.
2. In Google Search Console, add a **Domain** property (DNS TXT record, recommended) or a **URL-prefix** property using the HTML-tag method: copy the token into `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and redeploy.
3. Submit `https://<domain>/sitemap.xml` under *Sitemaps*.
4. Use *URL inspection* on `/` and `/services/dental-consultation`; request indexing.
5. Validate structured data with Google's Rich Results Test and the Schema.org validator on `/`, `/contact`, `/faq`, and a service page (record results in PHASE_10).
6. Bing Webmaster Tools: import from Search Console.

## 7. Analytics (optional, consent-dependent)

No analytics or tracking cookies are installed. If the clinic wants measurement, prefer privacy-friendly, cookie-less analytics (for example Vercel Web Analytics), update the Privacy Policy first, and add a consent banner if any tool sets non-essential cookies. Useful events: phone-link clicks, WhatsApp clicks, appointment request submitted (no personal data in events).

## 8. Content roadmap (after launch)

- Publish each confirmed service with clinic-approved copy (general information, what to expect, when to seek care, FAQs).
- Add real photographs with descriptive alt text.
- Add verified doctor credentials to the About page (shown automatically once entered).
- Optional Hindi pages (`/hi/...` with `hreflang`) if the clinic wants them; the dictionary structure is ready.
- Avoid creating separate pages for each nearby village; mention served areas naturally only if the clinic confirms it serves them.
