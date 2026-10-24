/**
 * schema.org JSON-LD builders. Every value comes from verified clinic settings
 * or published content; anything not yet verified (map coordinates, hours,
 * email, social profiles) is omitted rather than guessed. No ratings,
 * reviews, prices or awards are ever emitted.
 */
import type { Faq } from "@/features/faq/content";
import { WEEKDAYS, type PublicClinicSettings, type Weekday } from "@/features/clinic-settings/types";

type JsonLd = Record<string, unknown>;

const DAY_URI: Record<Weekday, string> = {
  mon: "https://schema.org/Monday",
  tue: "https://schema.org/Tuesday",
  wed: "https://schema.org/Wednesday",
  thu: "https://schema.org/Thursday",
  fri: "https://schema.org/Friday",
  sat: "https://schema.org/Saturday",
  sun: "https://schema.org/Sunday",
};

export const clinicId = (siteUrl: string) => `${siteUrl}/#clinic`;
export const websiteId = (siteUrl: string) => `${siteUrl}/#website`;

export function clinicJsonLd(settings: PublicClinicSettings, siteUrl: string): JsonLd {
  const a = settings.address;
  const hours = WEEKDAYS.flatMap((day) =>
    settings.weeklyHours[day].map((i) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY_URI[day], opens: i.open, closes: i.close })),
  );
  const sameAs = [...Object.values(settings.social), settings.mapUrl].filter((v): v is string => Boolean(v));

  return {
    "@context": "https://schema.org",
    "@type": "Dentist",
    "@id": clinicId(siteUrl),
    name: settings.clinicName,
    url: `${siteUrl}/`,
    telephone: settings.phoneE164,
    image: `${siteUrl}/brand/nav-dental-clinic-logo.webp`,
    logo: `${siteUrl}/brand/nav-dental-clinic-logo.webp`,
    medicalSpecialty: "https://schema.org/Dentistry",
    address: {
      "@type": "PostalAddress",
      streetAddress: [a.line1, a.line2].filter(Boolean).join(", "),
      addressLocality: a.locality,
      addressRegion: a.state,
      ...(a.postalCode ? { postalCode: a.postalCode } : {}),
      addressCountry: "IN",
    },
    ...(settings.geo ? { geo: { "@type": "GeoCoordinates", latitude: settings.geo.lat, longitude: settings.geo.lng } } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(settings: PublicClinicSettings, siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(siteUrl),
    name: settings.clinicName,
    url: `${siteUrl}/`,
    inLanguage: "en-IN",
    publisher: { "@id": clinicId(siteUrl) },
  };
}

export function breadcrumbJsonLd(items: { label: string; path: string }[], siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: `${siteUrl}${item.path === "/" ? "/" : item.path}`,
    })),
  };
}

export function serviceJsonLd(service: { slug: string; title: string; summary: string }, siteUrl: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.summary,
    url: `${siteUrl}/services/${service.slug}`,
    serviceType: "Dental care",
    provider: { "@id": clinicId(siteUrl) },
  };
}

/** FAQPage is only used on the dedicated FAQ page, whose answers reflect the clinic's own policies. */
export function faqJsonLd(faqs: Faq[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Serialises JSON-LD safely for an inline <script>: "<" is escaped so the data can never close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}
