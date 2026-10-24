import { describe, expect, it } from "vitest";

import { DEFAULT_PUBLIC_SETTINGS } from "@/features/clinic-settings/defaults";
import { buildRobotsRules, isIndexable } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, clinicJsonLd, faqJsonLd, serializeJsonLd, serviceJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";

const SITE = "https://navdental.example";

describe("indexing decision", () => {
  it("indexes only production HTTPS deployments on a public domain", () => {
    expect(isIndexable({ siteUrl: SITE })).toBe(true);
    expect(isIndexable({ siteUrl: SITE, vercelEnv: "production" })).toBe(true);
    expect(isIndexable({ siteUrl: SITE, vercelEnv: "preview" })).toBe(false);
    expect(isIndexable({ siteUrl: "http://navdental.example" })).toBe(false);
    expect(isIndexable({ siteUrl: "http://localhost:3000" })).toBe(false);
    expect(isIndexable({ siteUrl: "https://nav.test" })).toBe(false);
    expect(isIndexable({ siteUrl: "not a url" })).toBe(false);
  });

  it("honours an explicit override", () => {
    expect(isIndexable({ siteUrl: SITE, override: "off" })).toBe(false);
    expect(isIndexable({ siteUrl: "https://staging.example", vercelEnv: "preview", override: "on" })).toBe(true);
  });

  it("builds robots rules that always hide private areas", () => {
    const open = buildRobotsRules(true, SITE);
    expect(open).toMatchObject({ sitemap: `${SITE}/sitemap.xml` });
    expect(open.rules[0].disallow).toEqual(["/admin", "/api", "/appointment/status"]);
    expect(buildRobotsRules(false, SITE)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });
});

describe("page metadata", () => {
  it("sets a canonical path, Open Graph and Twitter data", () => {
    const meta = pageMetadata({ title: "Contact", description: "Find us", path: "/contact" });
    expect(meta.alternates).toEqual({ canonical: "/contact" });
    expect(meta.openGraph).toMatchObject({ url: "/contact", siteName: "NAV Dental Clinic", locale: "en_IN" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.robots).toBeUndefined();
    expect(pageMetadata({ title: "x", description: "y", path: "/z", noindex: true }).robots).toEqual({ index: false, follow: true });
  });
});

describe("structured data", () => {
  it("describes the clinic from verified settings only", () => {
    const data = clinicJsonLd(DEFAULT_PUBLIC_SETTINGS, SITE);
    expect(data).toMatchObject({
      "@type": "Dentist",
      "@id": `${SITE}/#clinic`,
      name: "NAV Dental Clinic",
      telephone: "+918006606001",
      address: { streetAddress: "Somna Road, Near Tata Kishan Kendra", addressLocality: "Pahasu", addressRegion: "Uttar Pradesh", addressCountry: "IN" },
    });
    // Unverified details are omitted, never invented.
    for (const key of ["geo", "email", "openingHoursSpecification", "sameAs", "aggregateRating", "review", "priceRange", "award"]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it("adds hours, coordinates and profiles once they are verified in settings", () => {
    const data = clinicJsonLd(
      {
        ...DEFAULT_PUBLIC_SETTINGS,
        geo: { lat: 28.17, lng: 78.0 },
        email: "clinic@example.com",
        social: { instagram: "https://instagram.com/navdental" },
        weeklyHours: { ...DEFAULT_PUBLIC_SETTINGS.weeklyHours, mon: [{ open: "10:00", close: "13:00" }] },
      },
      SITE,
    );
    expect(data.geo).toEqual({ "@type": "GeoCoordinates", latitude: 28.17, longitude: 78.0 });
    expect(data.openingHoursSpecification).toEqual([{ "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "10:00", closes: "13:00" }]);
    expect(data.sameAs).toEqual(["https://instagram.com/navdental"]);
  });

  it("links website, services and breadcrumbs to the clinic", () => {
    expect(websiteJsonLd(DEFAULT_PUBLIC_SETTINGS, SITE)).toMatchObject({ "@type": "WebSite", publisher: { "@id": `${SITE}/#clinic` } });
    expect(serviceJsonLd({ slug: "dental-consultation", title: "Dental Consultation", summary: "Check-up" }, SITE)).toMatchObject({
      url: `${SITE}/services/dental-consultation`,
      provider: { "@id": `${SITE}/#clinic` },
    });
    const crumbs = breadcrumbJsonLd([{ label: "Home", path: "/" }, { label: "Services", path: "/services" }], SITE);
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/services` },
    ]);
    expect(faqJsonLd([{ q: "Q?", a: "A." }]).mainEntity).toEqual([{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } }]);
  });

  it("serialises safely inside a script tag", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("</script>");
    expect(JSON.parse(json).name).toBe("</script><script>alert(1)</script>");
  });
});
