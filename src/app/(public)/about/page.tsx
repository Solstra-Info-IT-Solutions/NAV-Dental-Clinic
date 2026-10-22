import type { Metadata } from "next";

import { BookingActions } from "@/components/appointments/booking-cta";
import { PageHero } from "@/components/layout/page-hero";
import { CheckMark, Container, Section, SectionHeading } from "@/components/ui/layout-primitives";
import { Prose } from "@/components/ui/prose";
import { getPublicSettings } from "@/features/clinic-settings/queries";

export const metadata: Metadata = {
  title: "About Dr. Ratan Raghav and the Clinic",
  description: "Meet Dr. Ratan Raghav and learn about NAV Dental Clinic on Somna Road, Pahasu, and how appointments work.",
};

// Approach statements describe how visits are run. Wording is pending clinic approval (docs/PHASE_02_PUBLIC_UI.md).
const approach = [
  { lead: "Listen first.", text: "Your concerns and questions come before any examination." },
  { lead: "Explain clearly.", text: "Findings and options are described in plain language." },
  { lead: "Decide together.", text: "No treatment starts until you understand and agree to it." },
  { lead: "Respect your time.", text: "Patients are seen by appointment." },
];

export default async function AboutPage() {
  const settings = await getPublicSettings();

  return (
    <>
      <PageHero
        title={`About ${settings.clinicName}`}
        intro={`Dental care by ${settings.doctorName} on ${settings.address.line1}, ${settings.address.locality}.`}
        crumbs={[{ href: "/about", label: "About" }]}
      />

      <Section tone="white" aria-labelledby="doctor-title">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow text-graphite-500">The doctor</p>
            <h2 id="doctor-title" className="mt-3 font-display text-3xl md:text-4xl">
              {settings.doctorName}
            </h2>
            {settings.doctorCredentials ? <p className="mt-2 text-graphite-600">{settings.doctorCredentials}</p> : null}
          </div>
          <Prose>
            <p>
              {settings.doctorName} is the dentist at {settings.clinicName}. Patients are examined personally by the doctor, who
              explains what is found and talks through the options before any treatment is planned.
            </p>
            <p>
              If you have questions about a treatment or whether it is offered at the clinic, please call before your visit and the
              team will help.
            </p>
          </Prose>
        </Container>
      </Section>

      <Section aria-labelledby="clinic-title">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading id="clinic-title" eyebrow="The clinic" title="A local dental clinic in Pahasu" />
          <Prose>
            <p>
              {settings.clinicName} is located on {settings.address.line1}, {settings.address.line2?.replace(/^Near/, "near")},{" "}
              {settings.address.locality}. The clinic serves patients from {settings.address.locality} and the surrounding area.
            </p>
            <p>Appointments can be requested by phone, and the clinic confirms each appointment with the patient directly.</p>
          </Prose>
        </Container>
      </Section>

      <Section tone="white" aria-labelledby="approach-title">
        <Container>
          <SectionHeading id="approach-title" eyebrow="Our approach" title="How we look after you" />
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {approach.map(({ lead, text }) => (
              <li key={lead} className="flex gap-3 rounded-md border border-silver-200 bg-paper-50 p-5">
                <CheckMark className="mt-1" />
                <p>
                  <strong className="font-semibold">{lead}</strong> <span className="text-graphite-600">{text}</span>
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <section aria-labelledby="about-cta" className="surface-dark py-16">
        <Container className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <h2 id="about-cta" className="font-display text-3xl">
            Book a visit with {settings.doctorName}
          </h2>
          <BookingActions settings={settings} tone="dark" showRequestLink={false} />
        </Container>
      </section>
    </>
  );
}
