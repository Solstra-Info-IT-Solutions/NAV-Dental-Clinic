import { MessageCircle, Phone } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { formatPhoneDisplay, telHref, whatsappHref } from "@/features/clinic-settings/format";
import type { PublicClinicSettings } from "@/features/clinic-settings/types";

/** Primary contact actions, reused in hero, CTA bands and pages. */
export function BookingActions({
  settings,
  tone = "light",
  showRequestLink = true,
}: {
  settings: PublicClinicSettings;
  tone?: "light" | "dark";
  showRequestLink?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <ButtonLink href={telHref(settings.phoneE164)} tone={tone} size="lg">
        <Phone aria-hidden="true" className="size-5" />
        Call {formatPhoneDisplay(settings.phoneE164)}
      </ButtonLink>
      {settings.whatsappE164 ? (
        <ButtonLink
          href={whatsappHref(settings.whatsappE164, `Hello ${settings.clinicName}, I would like to book an appointment.`)}
          external
          tone={tone}
          variant="secondary"
          size="lg"
        >
          <MessageCircle aria-hidden="true" className="size-5" />
          WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </ButtonLink>
      ) : null}
      {showRequestLink ? (
        <ButtonLink href="/appointment" tone={tone} variant="secondary" size="lg">
          Request an appointment
        </ButtonLink>
      ) : null}
    </div>
  );
}
