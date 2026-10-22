import { describe, expect, it } from "vitest";

import { DEFAULT_PUBLIC_SETTINGS } from "@/features/clinic-settings/defaults";
import { buildGeneralFaqs } from "@/features/faq/content";
import { SERVICE_CATALOG } from "@/features/services/catalog";

describe("service catalog", () => {
  it("uses unique, URL-safe slugs (docs/DATABASE_SCHEMA.md §2)", () => {
    const slugs = SERVICE_CATALOG.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("publishes only services the clinic has confirmed", () => {
    expect(SERVICE_CATALOG.filter((s) => s.published).map((s) => s.slug)).toEqual(["dental-consultation"]);
  });

  it("respects schema length limits", () => {
    for (const s of SERVICE_CATALOG) {
      expect(s.title.length).toBeLessThanOrEqual(80);
      expect(s.summary.length).toBeLessThanOrEqual(200);
      expect(s.faqs.length).toBeLessThanOrEqual(10);
    }
  });

  it("avoids guarantee language in patient-facing copy", () => {
    const text = JSON.stringify(SERVICE_CATALOG).toLowerCase();
    for (const banned of ["guarantee", "painless treatment", "100%", "best dentist", "permanent results"]) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("general FAQs", () => {
  it("covers every topic required by the brief", () => {
    const questions = buildGeneralFaqs(DEFAULT_PUBLIC_SETTINGS).map((f) => f.q.toLowerCase());
    for (const topic of ["request an appointment", "confirmed", "reschedule", "information", "where is the clinic", "contact"]) {
      expect(questions.some((q) => q.includes(topic))).toBe(true);
    }
  });

  it("uses the configured phone number and omits WhatsApp until enabled", () => {
    const text = JSON.stringify(buildGeneralFaqs(DEFAULT_PUBLIC_SETTINGS));
    expect(text).toContain("+91 80066 06001");
    expect(text).not.toContain("WhatsApp");

    const withWhatsapp = JSON.stringify(buildGeneralFaqs({ ...DEFAULT_PUBLIC_SETTINGS, whatsappE164: "+918006606001" }));
    expect(withWhatsapp).toContain("WhatsApp");
  });

  it("never promises confirmation in request-based booking mode", () => {
    const confirm = buildGeneralFaqs(DEFAULT_PUBLIC_SETTINGS).find((f) => f.q.includes("confirmed"));
    expect(confirm?.a).toContain("not a confirmed appointment");
  });
});
