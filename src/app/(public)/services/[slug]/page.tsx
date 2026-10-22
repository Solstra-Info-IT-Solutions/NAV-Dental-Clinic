import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingActions } from "@/components/appointments/booking-cta";
import { FaqList } from "@/components/faq/faq-list";
import { PageHero } from "@/components/layout/page-hero";
import { Container, Section } from "@/components/ui/layout-primitives";
import { Prose } from "@/components/ui/prose";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { getPublishedService, getPublishedServices } from "@/features/services/queries";

// Render unlisted slugs completely before responding, so notFound() for an
// unknown or unpublished service returns a real HTTP 404 instead of a
// streamed soft-404 with status 200.
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const services = await getPublishedServices();
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  if (!service) return {};
  return { title: `${service.title} in Pahasu`, description: service.summary };
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const [service, settings, services] = await Promise.all([getPublishedService(slug), getPublicSettings(), getPublishedServices()]);
  if (!service) notFound();

  const related = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <>
      <PageHero
        title={service.title}
        intro={service.summary}
        crumbs={[
          { href: "/services", label: "Services" },
          { href: `/services/${service.slug}`, label: service.title },
        ]}
      />
      <Section tone="white">
        <Container className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <Prose>
            {service.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </section>
            ))}
            <p className="text-sm">
              This page is general information and is not a diagnosis or personal medical advice. The dentist will advise you after
              an examination.
            </p>
          </Prose>
          <aside aria-labelledby="book-aside" className="h-fit rounded-md bg-ink-900 p-6 text-platinum-100 lg:sticky lg:top-24">
            <h2 id="book-aside" className="font-display text-2xl">
              Book an appointment
            </h2>
            <p className="mt-2 text-silver-300">Speak to the clinic to arrange a visit with {settings.doctorName}.</p>
            <div className="mt-6 [&_a]:w-full">
              <BookingActions settings={settings} tone="dark" showRequestLink={false} />
            </div>
          </aside>
        </Container>
      </Section>

      {service.faqs.length > 0 ? (
        <Section aria-labelledby="service-faq">
          <Container className="max-w-3xl">
            <h2 id="service-faq" className="mb-8 font-display text-3xl">
              Questions about {service.title.toLowerCase()}
            </h2>
            <FaqList faqs={service.faqs} />
          </Container>
        </Section>
      ) : null}

      <Section tone="white" aria-labelledby="more-links">
        <Container>
          <h2 id="more-links" className="text-xl font-semibold">
            More information
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {related.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="font-medium underline underline-offset-4">
                  {s.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/services" className="font-medium underline underline-offset-4">
                All services
              </Link>
            </li>
            <li>
              <Link href="/faq" className="font-medium underline underline-offset-4">
                Appointment FAQs
              </Link>
            </li>
            <li>
              <Link href="/contact" className="font-medium underline underline-offset-4">
                Find the clinic
              </Link>
            </li>
          </ul>
        </Container>
      </Section>
    </>
  );
}
