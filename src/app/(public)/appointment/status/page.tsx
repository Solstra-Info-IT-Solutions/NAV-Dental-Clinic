import type { Metadata } from "next";

import { StatusLookupForm } from "@/components/appointments/status-lookup-form";
import { PageHero } from "@/components/layout/page-hero";
import { Container, Section } from "@/components/ui/layout-primitives";
import { formatPhoneDisplay } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";

export const metadata: Metadata = {
  title: "Check Appointment Request Status",
  description: "Check the status of an appointment request at NAV Dental Clinic using your booking reference and mobile number.",
  // Personal lookups have no search value.
  robots: { index: false, follow: true },
};

export default async function AppointmentStatusPage() {
  const settings = await getPublicSettings();
  return (
    <>
      <PageHero
        title="Check your request"
        intro="Enter the booking reference you received and the mobile number you used."
        crumbs={[
          { href: "/appointment", label: "Appointment" },
          { href: "/appointment/status", label: "Check status" },
        ]}
      />
      <Section tone="white">
        <Container className="max-w-2xl">
          <StatusLookupForm />
          <p className="mt-10 text-graphite-600">
            To change or cancel an appointment, please call the clinic on {formatPhoneDisplay(settings.phoneE164)}.
          </p>
        </Container>
      </Section>
    </>
  );
}
