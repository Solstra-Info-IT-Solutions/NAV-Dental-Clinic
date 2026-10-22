import type { Metadata } from "next";

import { BookingActions } from "@/components/appointments/booking-cta";
import { ClinicAddress, OpeningHours } from "@/components/contact/contact-blocks";
import { PageHero } from "@/components/layout/page-hero";
import { Alert } from "@/components/ui/feedback";
import { Container, Section } from "@/components/ui/layout-primitives";
import { formatPhoneDisplay, isOnlineBookingOpen } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";

export const metadata: Metadata = {
  title: "Book a Dental Appointment",
  description: "Book a dental appointment at NAV Dental Clinic, Pahasu. Call +91 80066 06001 to arrange a visit with Dr. Ratan Raghav.",
};

export default async function AppointmentPage() {
  const settings = await getPublicSettings();
  const bookingOpen = isOnlineBookingOpen(settings);
  const phone = formatPhoneDisplay(settings.phoneE164);

  return (
    <>
      <PageHero
        title="Book an appointment"
        intro={`Arrange a visit with ${settings.doctorName} at ${settings.clinicName}.`}
        crumbs={[{ href: "/appointment", label: "Appointment" }]}
      />
      <Section tone="white">
        <Container className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            {/* The online request form (Phase 4) renders here once the clinic has configured opening hours. */}
            {!bookingOpen ? (
              <Alert kind="info" title="Online appointment requests are not available yet">
                <p>Please call the clinic on {phone} to book. The team will find a suitable time with you.</p>
              </Alert>
            ) : null}
            <div className="mt-8">
              <BookingActions settings={settings} showRequestLink={false} />
            </div>

            <h2 className="mt-12 text-xl font-semibold">When you call, please have ready</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-graphite-600">
              <li>Your full name and a mobile number the clinic can reach you on</li>
              <li>The reason for your visit (for example a check-up, pain or a broken tooth)</li>
              <li>The days and times that suit you</li>
            </ul>
            <p className="mt-6 text-graphite-600">
              If you have severe swelling, difficulty breathing or swallowing, or heavy bleeding, seek urgent medical care immediately.
            </p>
          </div>

          <aside aria-labelledby="visit-info" className="h-fit space-y-6 rounded-md border border-silver-200 bg-paper-50 p-6">
            <h2 id="visit-info" className="text-xl font-semibold">
              Visiting the clinic
            </h2>
            <ClinicAddress settings={settings} className="text-graphite-600" />
            <div>
              <h3 className="eyebrow mb-2 text-graphite-500">Clinic timings</h3>
              <OpeningHours settings={settings} />
            </div>
          </aside>
        </Container>
      </Section>
    </>
  );
}
