import { CalendarCheck, ClipboardList, MapPin, PhoneCall, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { BookingActions } from "@/components/appointments/booking-cta";
import { ClinicAddress, ContactLinks, OpeningHours } from "@/components/contact/contact-blocks";
import { FaqList } from "@/components/faq/faq-list";
import { ServiceCard } from "@/components/services/service-card";
import { ButtonLink } from "@/components/ui/button";
import { CheckMark, Container, Section, SectionHeading, SilverRule } from "@/components/ui/layout-primitives";
import { isOnlineBookingOpen } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { buildGeneralFaqs } from "@/features/faq/content";
import { getPublishedServices } from "@/features/services/queries";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { clinicJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return pageMetadata({
    title: settings.seo?.defaultTitle || "NAV Dental Clinic, Pahasu | Dr. Ratan Raghav",
    description:
      settings.seo?.defaultDescription ||
      "Dental clinic on Somna Road, near Tata Kishan Kendra, Pahasu. Call +91 80066 06001 or request an appointment with Dr. Ratan Raghav online.",
    path: "/",
    absoluteTitle: true,
  });
}

const bookingSteps = [
  {
    icon: ClipboardList,
    title: "Send your request",
    body: "Call the clinic, or share your name, mobile number, the visit you need and a preferred time.",
  },
  {
    icon: PhoneCall,
    title: "The clinic confirms",
    body: "The team reviews your request and calls you on your mobile number to confirm the date and time.",
  },
  {
    icon: CalendarCheck,
    title: "Visit the clinic",
    body: "Come to the clinic at your confirmed time. Bring a list of your medicines and any previous dental reports.",
  },
] as const;

export default async function HomePage() {
  const [settings, services] = await Promise.all([getPublicSettings(), getPublishedServices()]);
  const faqs = buildGeneralFaqs(settings).slice(0, 4);
  const bookingOpen = isOnlineBookingOpen(settings);

  // Factual, verifiable statements about how the clinic and this site work — no unverifiable claims.
  const reasons = [
    { icon: CalendarCheck, title: "Clear appointment requests", body: "Every request is reviewed by the clinic team, and you are contacted to confirm the time." },
    { icon: PhoneCall, title: "Talk to the clinic directly", body: settings.whatsappE164 ? "Reach the clinic by phone or WhatsApp with your questions." : "Reach the clinic by phone with your questions." },
    { icon: MapPin, title: "Easy to find", body: `On ${[settings.address.line1, settings.address.line2, settings.address.locality].filter(Boolean).join(", ")}.` },
    { icon: ShieldCheck, title: "Your details stay private", body: "Details you share on this website are used to arrange and manage your appointment." },
  ];

  return (
    <>
      <JsonLd data={[clinicJsonLd(settings, siteConfig.url), websiteJsonLd(settings, siteConfig.url)]} />
      {/* Hero */}
      <section aria-labelledby="hero-title" className="surface-dark overflow-hidden">
        <Container className="grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="eyebrow text-silver-300">Dental clinic in {settings.address.locality}</p>
            <h1 id="hero-title" className="mt-4 font-display text-4xl leading-tight md:text-6xl">
              Careful dental care, close to home
            </h1>
            <p className="mt-6 max-w-xl text-lg text-silver-200">
              {settings.clinicName} is led by <strong className="font-semibold text-platinum-100">{settings.doctorName}</strong> on{" "}
              {settings.address.line1}, {settings.address.locality}.{" "}
              {bookingOpen
                ? "Call to book, or send an appointment request and the clinic will confirm a time with you."
                : "Call the clinic to book your appointment."}
            </p>
            <div className="mt-8">
              <BookingActions settings={settings} tone="dark" showRequestLink={bookingOpen} />
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-64 sm:max-w-sm lg:max-w-md">
            <Image
              src="/brand/nav-dental-clinic-logo.webp"
              alt={`${settings.clinicName} logo`}
              width={1080}
              height={1080}
              fetchPriority="high"
              loading="eager"
              sizes="(min-width: 1024px) 28rem, (min-width: 640px) 24rem, 16rem"
              className="h-auto w-full rounded-md"
            />
          </div>
        </Container>
      </section>

      {/* Introduction */}
      <Section tone="white" aria-labelledby="intro-title">
        <Container className="grid gap-10 lg:grid-cols-2">
          <SectionHeading id="intro-title" eyebrow="Welcome" title={`About ${settings.clinicName}`} />
          <div className="space-y-4 text-lg text-graphite-600">
            <p>
              {settings.clinicName} provides dental care for patients in and around {settings.address.locality}. Each visit starts with
              listening to your concerns and explaining what the dentist finds in plain language.
            </p>
            <p>
              You will always know what your options are before any treatment, so you can make decisions about your care with
              confidence.
            </p>
            <ButtonLink href="/about" variant="secondary">
              About the clinic
            </ButtonLink>
          </div>
        </Container>
      </Section>

      {/* Services */}
      <Section aria-labelledby="services-title">
        <Container>
          <SectionHeading
            id="services-title"
            eyebrow="Services"
            title="Dental services"
            intro="Start with a consultation. The dentist will explain what is needed and which treatments are available at the clinic."
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li key={service.slug}>
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
          <p className="mt-8 text-graphite-600">
            Looking for a specific treatment? Call the clinic to ask whether it is available.
          </p>
        </Container>
      </Section>

      {/* Doctor */}
      <Section tone="dark" aria-labelledby="doctor-title">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow text-silver-300">Your dentist</p>
            <h2 id="doctor-title" className="mt-3 font-display text-3xl md:text-4xl">
              {settings.doctorName}
            </h2>
            {settings.doctorCredentials ? <p className="mt-2 text-silver-300">{settings.doctorCredentials}</p> : null}
          </div>
          <div className="space-y-4 text-lg text-silver-200">
            <p>
              {settings.doctorName} leads the care at {settings.clinicName}. Patients are seen by appointment so that each visit has the
              time it needs for a proper examination and explanation.
            </p>
            <ButtonLink href="/about" tone="dark" variant="secondary">
              Meet the doctor
            </ButtonLink>
          </div>
        </Container>
      </Section>

      {/* Why choose */}
      <Section tone="white" aria-labelledby="why-title">
        <Container>
          <SectionHeading id="why-title" eyebrow="Visiting the clinic" title="What you can expect" />
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {reasons.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon aria-hidden="true" className="size-7 text-ink-900" strokeWidth={1.5} />
                <SilverRule className="my-4 w-12" />
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-graphite-600">{body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Booking */}
      <Section aria-labelledby="booking-title">
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              id="booking-title"
              eyebrow="Appointments"
              title="How to book"
              intro={
                settings.bookingMode === "request"
                  ? "Online requests are reviewed by the clinic before they are confirmed."
                  : "Online bookings reserve your time slot immediately."
              }
            />
            <div className="mt-8">
              <BookingActions settings={settings} showRequestLink={bookingOpen} />
            </div>
          </div>
          <ol className="space-y-6">
            {bookingSteps.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="flex gap-4 rounded-md border border-silver-200 bg-white p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-platinum-100">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">
                    <span className="sr-only">Step {index + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-1 text-graphite-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Location */}
      <Section tone="white" aria-labelledby="location-title">
        <Container className="grid gap-10 lg:grid-cols-3">
          <SectionHeading id="location-title" eyebrow="Location" title="Find the clinic" />
          <div className="space-y-4 text-lg text-graphite-600">
            <ClinicAddress settings={settings} />
            <ContactLinks settings={settings} />
          </div>
          <div>
            <h3 className="eyebrow mb-3 text-graphite-500">Clinic timings</h3>
            <OpeningHours settings={settings} />
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section aria-labelledby="faq-title">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading id="faq-title" eyebrow="Questions" title="Frequently asked questions" />
            <ButtonLink href="/faq" variant="secondary" className="mt-6">
              All questions
            </ButtonLink>
          </div>
          <FaqList faqs={faqs} />
        </Container>
      </Section>

      {/* Closing CTA */}
      <section aria-labelledby="cta-title" className="surface-dark py-16 md:py-20">
        <Container className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 id="cta-title" className="font-display text-3xl md:text-4xl">
              Ready to see the dentist?
            </h2>
            <p className="mt-3 flex items-start gap-2 text-silver-300">
              <CheckMark className="mt-1 text-silver-200" />
              Call the clinic and the team will help you find a suitable time.
            </p>
          </div>
          <BookingActions settings={settings} tone="dark" showRequestLink={bookingOpen} />
        </Container>
      </section>
    </>
  );
}
