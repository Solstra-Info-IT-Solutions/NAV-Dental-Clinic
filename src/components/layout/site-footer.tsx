import Link from "next/link";

import { ClinicAddress, ContactLinks, OpeningHours } from "@/components/contact/contact-blocks";
import { legalNav, primaryNav } from "@/config/navigation";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { getDictionary } from "@/i18n";

import { Logo } from "./logo";

export async function SiteFooter() {
  const t = getDictionary();
  const settings = await getPublicSettings();
  const socials = Object.entries(settings.social).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <footer className="surface-dark border-t border-ink-700">
      <div className="mx-auto grid max-w-site gap-12 px-4 py-16 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo tone="dark" />
          <p className="text-silver-300">Dental care by {settings.doctorName} in {settings.address.locality}.</p>
        </div>

        <div>
          <h2 className="eyebrow mb-4 text-silver-300">{t.footer.visit}</h2>
          <div className="space-y-4 text-silver-200">
            <ClinicAddress settings={settings} tone="dark" />
            <ContactLinks settings={settings} tone="dark" />
          </div>
        </div>

        <div>
          <h2 className="eyebrow mb-4 text-silver-300">Clinic timings</h2>
          <OpeningHours settings={settings} tone="dark" />
        </div>

        <nav aria-label="Footer">
          <h2 className="eyebrow mb-4 text-silver-300">{t.footer.explore}</h2>
          <ul className="space-y-1">
            {[...primaryNav(t), { href: "/appointment", label: t.cta.requestAppointment }].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-10 items-center text-silver-200 hover:text-platinum-100">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {socials.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-4">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer me" className="capitalize text-silver-200 hover:text-platinum-100">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-ink-700">
        <div className="mx-auto flex max-w-site flex-col gap-3 px-4 py-6 text-sm text-steel-400 md:flex-row md:items-center md:justify-between md:px-6">
          <p>© {settings.clinicName}. All rights reserved.</p>
          <ul className="flex gap-6" aria-label={t.footer.legal}>
            {legalNav(t).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-10 items-center text-silver-300 hover:text-platinum-100">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
