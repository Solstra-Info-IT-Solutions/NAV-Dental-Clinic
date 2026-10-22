import { CalendarCheck, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

import { telHref, whatsappHref } from "@/features/clinic-settings/format";
import { getPublicSettings } from "@/features/clinic-settings/queries";
import { getDictionary } from "@/i18n";

const itemClass =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold tracking-wide";

/** Sticky bottom bar on small screens so calling or booking is always one tap away. */
export async function MobileActionBar() {
  const t = getDictionary();
  const settings = await getPublicSettings();

  return (
    <nav
      aria-label="Quick actions"
      className="surface-dark fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-700 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <a href={telHref(settings.phoneE164)} className={`${itemClass} text-platinum-100`}>
        <Phone aria-hidden="true" className="size-5" />
        {t.cta.call}
      </a>
      {settings.whatsappE164 ? (
        <a
          href={whatsappHref(settings.whatsappE164)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${itemClass} border-l border-ink-700 text-platinum-100`}
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          {t.cta.whatsapp}
          <span className="sr-only"> {t.common.opensInNewTab}</span>
        </a>
      ) : null}
      <Link href="/appointment" className={`${itemClass} bg-platinum-100 text-ink-900`}>
        <CalendarCheck aria-hidden="true" className="size-5" />
        {t.cta.book}
      </Link>
    </nav>
  );
}
