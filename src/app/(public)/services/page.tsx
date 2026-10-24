import type { Metadata } from "next";

import { BookingActions } from "@/components/appointments/booking-cta";
import { PageHero } from "@/components/layout/page-hero";
import { ServiceCard } from "@/components/services/service-card";
import { EmptyState } from "@/components/ui/feedback";
import { Container, Section } from "@/components/ui/layout-primitives";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { getPublishedServices } from "@/features/services/queries";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Dental Services",
  description:
    "Dental services at NAV Dental Clinic, Pahasu. Book a consultation with Dr. Ratan Raghav to discuss your treatment options.",
  path: "/services",
});

export default async function ServicesPage() {
  const [settings, services] = await Promise.all([getPublicSettings(), getPublishedServices()]);

  return (
    <>
      <PageHero
        title="Dental services"
        intro="Most care begins with a consultation, where the dentist examines your teeth and explains the options available."
        crumbs={[{ href: "/services", label: "Services" }]}
      />
      <Section>
        <Container>
          {services.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <li key={service.slug}>
                  <ServiceCard service={service} headingLevel="h2" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Service details are being updated">Please call the clinic to ask about treatments.</EmptyState>
          )}
          <div className="mt-12 rounded-md border border-silver-200 bg-white p-6 md:p-8">
            <h2 className="text-xl font-semibold">Looking for a specific treatment?</h2>
            <p className="mt-2 max-w-2xl text-graphite-600">
              Call the clinic to ask whether a treatment is available, or book a consultation so the dentist can advise you.
            </p>
            <div className="mt-6">
              <BookingActions settings={settings} showRequestLink={false} />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
