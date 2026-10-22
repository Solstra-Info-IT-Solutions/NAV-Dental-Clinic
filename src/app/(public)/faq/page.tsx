import type { Metadata } from "next";

import { BookingActions } from "@/components/appointments/booking-cta";
import { FaqList } from "@/components/faq/faq-list";
import { PageHero } from "@/components/layout/page-hero";
import { Container, Section } from "@/components/ui/layout-primitives";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { buildGeneralFaqs } from "@/features/faq/content";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "How to book, confirm, reschedule or cancel an appointment at NAV Dental Clinic, Pahasu, and how to find the clinic.",
};

export default async function FaqPage() {
  const settings = await getPublicSettings();
  return (
    <>
      <PageHero
        title="Frequently asked questions"
        intro="Answers about appointments, contacting the clinic and finding us."
        crumbs={[{ href: "/faq", label: "FAQ" }]}
      />
      <Section tone="white">
        <Container className="max-w-3xl">
          <FaqList faqs={buildGeneralFaqs(settings)} headingLevel="h2" />
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
