import type { Metadata } from "next";

import { BookingActions } from "@/components/appointments/booking-cta";
import { ClinicAddress, ContactLinks, OpeningHours } from "@/components/contact/contact-blocks";
import { ContactForm } from "@/components/contact/contact-form";
import { PageHero } from "@/components/layout/page-hero";
import { Container, Section } from "@/components/ui/layout-primitives";
import { formatPhoneDisplay } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { clinicJsonLd } from "@/lib/seo/structured-data";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Contact and Directions",
  description:
    "Contact NAV Dental Clinic on Somna Road, near Tata Kishan Kendra, Pahasu, Uttar Pradesh. Phone +91 80066 06001 or get directions.",
  path: "/contact",
});

export default async function ContactPage() {
  const settings = await getPublicSettings();

  return (
    <>
      <JsonLd data={clinicJsonLd(settings, siteConfig.url)} />
      <PageHero
        title="Contact the clinic"
        intro="Call the clinic, send a message, or use the directions link to find us."
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
      <Section aria-labelledby="enquiry-title">
        <Container className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h2 id="enquiry-title" className="font-display text-3xl">
              Send a message
            </h2>
            <p className="mt-3 max-w-2xl text-graphite-600">
              Questions about the clinic or a treatment? Send a message and the team will reply on your mobile number.
            </p>
            <div className="mt-8">
              <ContactForm phoneLabel={formatPhoneDisplay(settings.phoneE164)} />
            </div>
          </div>
          <aside aria-labelledby="other-ways" className="h-fit space-y-4 rounded-md border border-silver-200 bg-white p-6">
            <h2 id="other-ways" className="text-xl font-semibold">
              Prefer to talk?
            </h2>
            <p className="text-graphite-600">
              To book an appointment, calling is quickest
              {settings.whatsappE164 ? ", or send us a WhatsApp message" : ""}.
            </p>
            <BookingActions settings={settings} showRequestLink={false} />
            <p className="text-sm text-graphite-600">For a medical emergency, seek urgent medical care immediately.</p>
          </aside>
        </Container>
      </Section>
    </>
  );
}
