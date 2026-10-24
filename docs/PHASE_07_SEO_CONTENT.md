# Phase 7 — SEO and Content

**Status:** Tested (locally; production indexing, Search Console and the Rich Results Test need the real domain)
**Date:** 2026-10-24

## 1. Objective and business value

Help people near Pahasu who search for a dentist find NAV Dental Clinic, and make sure search engines see one consistent, accurate clinic: correct name, address and phone, real services, no invented facts. Private areas and unfinished deployments stay out of search results.

## 2. Files created or modified

| Area | Files |
|---|---|
| Indexing and crawl control | `src/lib/seo/indexing.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts` (`noindex` header on non-production builds), `src/proxy.ts` (canonical-host 308 redirect in production; existing admin redirect kept) |
| Metadata | `src/lib/seo/metadata.ts` (`pageMetadata`); all public pages updated; `src/app/layout.tsx` (OG/Twitter defaults, Search Console verification); `src/app/opengraph-image.tsx` |
| Structured data | `src/lib/seo/structured-data.ts`, `src/components/seo/json-ld.tsx`; wired into home, contact, service, FAQ pages and `Breadcrumbs` |
| Owner-editable SEO | `clinic-settings` schema/types/repository (`seo.defaultTitle/defaultDescription`), admin settings form section *Search engines*; services `seo` exposed to pages |
| Renamed services | `findServiceRedirects` / `getServiceRedirect` + `permanentRedirect` in `services/[slug]` |
| Tests | `tests/unit/seo.test.ts`, `tests/e2e/seo.spec.ts`, redirect assertions in `tests/integration/admin-services.test.ts` |
| Docs | `docs/SEO_STRATEGY.md` (keyword map, internal links, local SEO, Search Console), this file, `IMPLEMENTATION_STATUS.md` |

## 3. Decisions

| Topic | Decision |
|---|---|
| When to index | Only when `NEXT_PUBLIC_SITE_URL` is HTTPS on a public domain **and** the deployment is production (`VERCEL_ENV` unset or `production`). `SITE_INDEXING=off\|on` overrides. Otherwise `robots.txt` disallows everything and every response carries `X-Robots-Tag: noindex, nofollow`. |
| Private areas | Always disallowed and `noindex`: `/admin`, `/api`, `/appointment/status`. Draft legal pages are `noindex` and left out of the sitemap until the owner approves them. |
| Canonical host | Per-page `<link rel="canonical">` from `metadataBase`. In production, any other host redirects 308 to the canonical domain (`/api` excluded). |
| Titles and descriptions | Unique per page; the home page title and description can be changed by the owner in Clinic settings; each service can override its own. |
| Share image | A generated 1200×630 PNG in the brand palette with the provisional mark. It is referenced explicitly in every page's Open Graph and Twitter metadata, because Next.js merges metadata shallowly and page-level `openGraph` otherwise drops it (found by testing). |
| Structured data | `Dentist` (+ `WebSite` on home) with `@id` links, `BreadcrumbList` from the visible breadcrumbs, `Service` per published service, and `FAQPage` only on `/faq`, using the exact answers shown. Hours, coordinates, email and `sameAs` are added only once they exist in settings. Ratings, reviews, prices, awards and medical claims are **never** emitted. JSON is escaped so `</script>` can't break out. |
| District "BSR" | Not included in structured data or the keyword copy until the clinic confirms it means Bulandshahr. |
| Locality pages | None. Thin doorway pages would hurt trust and rankings (see SEO_STRATEGY §1). |

## 4. Checks executed

| Command | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm run test` | ✅ 15 files, **148 tests passed** |
| `npm run build` | ✅ exit 0 (`/robots.txt`, `/sitemap.xml`, `/opengraph-image` generated) |
| `npx playwright test` | ✅ **106 passed**, 30 skipped by design (device-specific) |

An earlier E2E run had 2 failures caused by the computer going to sleep mid-run (`ERR_NETWORK_IO_SUSPENDED`). The rerun passed; no code change was needed.

SEO tests cover:
- the indexing decision for production, preview, http, localhost, `.test` and override;
- robots rules;
- page metadata;
- every JSON-LD builder, including omission of unverified fields and forbidden fields;
- script-safe escaping;
- service rename redirect mapping.

E2E against the built site covers:
- `robots.txt` disallows all locally, with an `X-Robots-Tag` header;
- the sitemap includes the public pages and published services, and excludes admin, API, status, draft legal pages and unpublished services;
- all 9 public pages have unique titles, descriptions over 50 characters, a correct canonical path, OG and Twitter tags;
- the OG image is served as a 1200×630 PNG with alt text;
- the home page JSON-LD has a Dentist with the verified telephone and address and no ratings, reviews, prices or coordinates;
- the service page has Service and Breadcrumb data matching the visible trail;
- the FAQPage questions match the visible FAQs exactly;
- every page has one H1 and no images without alt text.

## 5. Known issues / limitations

- **Not verifiable until launch:** real indexing, Search Console, the Rich Results / Schema.org validator on the live URL, and the canonical-host redirect on the real domain.
- The share image uses a fallback sans-serif for "NAV" (Cinzel isn't loaded in the image generator). It can be refined if the client supplies the vector logo.
- Opening hours in structured data come from settings. Locally they are the **sample** hours, which is fine because local builds are `noindex`; production shows only the clinic's real hours once entered.
- FAQ rich results aren't expected (Google limits them to authoritative health and government sites); the markup stays valid and descriptive.
- No analytics installed (deliberately; see SEO_STRATEGY §7).

## 6. Completion checklist

- [x] Metadata API: unique titles and descriptions, canonical URLs, Open Graph, Twitter
- [x] XML sitemap and robots.txt; private and draft pages excluded
- [x] No accidental indexing of admin, private or non-production pages (robots + header + meta)
- [x] Canonical host redirect (production)
- [x] Breadcrumbs with matching structured data; internal linking
- [x] Structured data from verified data only
- [x] Redirects for renamed services
- [x] Image alt text and heading outline verified
- [x] Search Console and GBP instructions (SEO_STRATEGY §5–6)
- [ ] Live validation (Rich Results Test, Search Console), after deployment

## 7. External inputs required

Domain; Google Business Profile access; verified map pin; PIN code; confirmation of "BSR"; real opening hours; social profile links (if any); the clinic's approval of service copy, meta titles and descriptions.
