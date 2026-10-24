import type { Metadata } from "next";

import { BookingActions } from "@/components/appointments/booking-cta";
import { FaqList } from "@/components/faq/faq-list";
import { PageHero } from "@/components/layout/page-hero";
import { Container, Section } from "@/components/ui/layout-primitives";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { buildGeneralFaqs } from "@/features/faq/content";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { faqJsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Frequently Asked Questions",
  description:
    "How to book, confirm, reschedule or cancel an appointment at NAV Dental Clinic, Pahasu, and how to find the clinic.",
  path: "/faq",
});

export default async function FaqPage() {
  const settings = await getPublicSettings();
  const faqs = buildGeneralFaqs(settings);
  return (
    <>
      <JsonLd data={faqJsonLd(faqs)} />
      <PageHero
        title="Frequently asked questions"
        intro="Answers about appointments, contacting the clinic and finding us."
        crumbs={[{ href: "/faq", label: "FAQ" }]}
      />
      <Section tone="white">
        <Container className="max-w-3xl">
          <FaqList faqs={faqs} headingLevel="h2" />
          <div className="mt-12">
            <h2 className="text-xl font-semibold">Still have a question?</h2>
            <p className="mt-2 text-graphite-600">Call the clinic and the team will be glad to help.</p>
            <div className="mt-6">
              <BookingActions settings={settings} showRequestLink={false} />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
