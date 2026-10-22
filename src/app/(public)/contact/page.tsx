import type { Metadata } from "next";

import { BookingActions } from "@/components/appointments/booking-cta";
import { ClinicAddress, ContactLinks, OpeningHours } from "@/components/contact/contact-blocks";
import { PageHero } from "@/components/layout/page-hero";
import { Container, Section } from "@/components/ui/layout-primitives";
import { getPublicSettings } from "@/features/clinic-settings/queries";

export const metadata: Metadata = {
  title: "Contact and Directions",
  description:
    "Contact NAV Dental Clinic on Somna Road, near Tata Kishan Kendra, Pahasu, Uttar Pradesh. Phone +91 80066 06001 or get directions.",
};

export default async function ContactPage() {
  const settings = await getPublicSettings();

  return (
    <>
      <PageHero
        title="Contact the clinic"
        intro="Call the clinic for appointments and questions, or use the directions link to find us."
        crumbs={[{ href: "/contact", label: "Contact" }]}
      />
      <Section tone="white">
        <Container className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          <section aria-labelledby="address-title">
            <h2 id="address-title" className="eyebrow mb-4 text-graphite-500">
              Address
            </h2>
            <ClinicAddress settings={settings} className="text-lg text-graphite-600" />
          </section>
          <section aria-labelledby="reach-title">
            <h2 id="reach-title" className="eyebrow mb-4 text-graphite-500">
              Phone and directions
            </h2>
            <ContactLinks settings={settings} />
          </section>
          <section aria-labelledby="hours-title">
            <h2 id="hours-title" className="eyebrow mb-4 text-graphite-500">
              Clinic timings
            </h2>
            <OpeningHours settings={settings} />
          </section>
        </Container>
      </Section>
      {/* The enquiry form (Phase 5) is added here. */}
      <Section aria-labelledby="contact-cta">
        <Container>
          <h2 id="contact-cta" className="font-display text-3xl">
            Book an appointment
          </h2>
          <p className="mt-3 max-w-2xl text-graphite-600">The quickest way to arrange a visit is to call the clinic.</p>
          <div className="mt-8">
            <BookingActions settings={settings} showRequestLink={false} />
          </div>
        </Container>
      </Section>
    </>
  );
}
