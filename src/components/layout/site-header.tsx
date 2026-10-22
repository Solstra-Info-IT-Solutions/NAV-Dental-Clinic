import { Phone } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { primaryNav } from "@/config/navigation";
import { formatPhoneDisplay, telHref } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { getDictionary } from "@/i18n";

import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const t = getDictionary();
  const settings = await getPublicSettings();
  const items = primaryNav(t);

  return (
    <header className="surface-dark sticky top-0 z-40 border-b border-ink-700">
      <div className="relative mx-auto flex h-18 max-w-site items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="rounded-md">
          <Logo tone="dark" />
        </Link>

        <nav aria-label={t.nav.label} className="hidden lg:block">
          <NavLinks items={items} />
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href={telHref(settings.phoneE164)}
            className="hidden min-h-11 items-center gap-2 whitespace-nowrap px-3 xl:inline-flex text-[0.9375rem] font-medium text-silver-200 hover:text-platinum-100"
          >
            <Phone aria-hidden="true" className="size-4" />
            {formatPhoneDisplay(settings.phoneE164)}
          </a>
          <ButtonLink href="/appointment" tone="dark">
            {t.cta.requestAppointment}
          </ButtonLink>
        </div>

        <MobileNav
          items={items}
          phoneHref={telHref(settings.phoneE164)}
          phoneLabel={t.cta.call}
          bookLabel={t.cta.book}
          openLabel={t.nav.openMenu}
          closeLabel={t.nav.closeMenu}
          navLabel={t.nav.label}
        />
      </div>
    </header>
  );
}
