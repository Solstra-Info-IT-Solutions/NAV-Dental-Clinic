import type { Metadata } from "next";
import Link from "next/link";

import { BookingActions } from "@/components/appointments/booking-cta";
import { BookingForm } from "@/components/appointments/booking-form";
import { ClinicAddress, OpeningHours } from "@/components/contact/contact-blocks";
import { PageHero } from "@/components/layout/page-hero";
import { Alert } from "@/components/ui/feedback";
import { Container, Section } from "@/components/ui/layout-primitives";
import { formatPhoneDisplay, isOnlineBookingOpen, telHref } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { getPublishedServices } from "@/features/services/queries";

export const metadata: Metadata = {
  title: "Book a Dental Appointment",
  description: "Request a dental appointment at NAV Dental Clinic, Pahasu, online or call +91 80066 06001 to arrange a visit with Dr. Ratan Raghav.",
};

export default async function AppointmentPage() {
  const [settings, services] = await Promise.all([getPublicSettings(), getPublishedServices()]);
  const bookable = services.filter((s) => s.bookable).map(({ slug, title }) => ({ slug, title }));
  const onlineOpen = isOnlineBookingOpen(settings) && bookable.length > 0;
  const phone = formatPhoneDisplay(settings.phoneE164);

  return (
    <>
      <PageHero
        title="Book an appointment"
        intro={
          onlineOpen && settings.bookingMode === "request"
            ? "Send a request for a time that suits you. The clinic will call you to confirm it."
            : `Arrange a visit with ${settings.doctorName} at ${settings.clinicName}.`
        }
        crumbs={[{ href: "/appointment", label: "Appointment" }]}
      />
      <Section tone="white">
        <Container className="grid gap-12 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            {onlineOpen ? (
              <BookingForm services={bookable} phoneHref={telHref(settings.phoneE164)} phoneLabel={phone} />
            ) : (
              <>
                <Alert kind="info" title="Online appointment requests are not available yet">
                  <p>Please call the clinic on {phone} to book. The team will find a suitable time with you.</p>
                </Alert>
                <div className="mt-8">
                  <BookingActions settings={settings} showRequestLink={false} />
                </div>
                <h2 className="mt-12 text-xl font-semibold">When you call, please have ready</h2>
                <ul className="mt-4 list-disc space-y-2 pl-6 text-graphite-600">
                  <li>Your full name and a mobile number the clinic can reach you on</li>
                  <li>The reason for your visit (for example a check-up, pain or a broken tooth)</li>
                  <li>The days and times that suit you</li>
                </ul>
              </>
            )}
            <p className="mt-10 text-graphite-600">
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
            <div className="border-t border-silver-200 pt-6">
              <h3 className="font-semibold">Already sent a request?</h3>
              <p className="mt-1 text-graphite-600">
                <Link href="/appointment/status" className="font-medium text-ink-900 underline underline-offset-4">
                  Check your request status
                </Link>{" "}
                with your reference and mobile number.
              </p>
            </div>
          </aside>
        </Container>
      </Section>
    </>
  );
}
