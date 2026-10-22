import { MapPin, MessageCircle, Phone } from "lucide-react";

import {
  addressLines,
  directionsUrl,
  formatPhoneDisplay,
  hasOpeningHours,
  openingHoursRows,
  telHref,
  whatsappHref,
} from "@/features/clinic-settings/format";
import type { PublicClinicSettings } from "@/features/clinic-settings/types";
import { cn } from "@/lib/cn";

type Tone = { tone?: "light" | "dark" };

/** Name/address block. `<address>` keeps NAP details semantic and consistent site-wide. */
export function ClinicAddress({ settings, tone = "light", className }: { settings: PublicClinicSettings; className?: string } & Tone) {
  return (
    <address className={cn("not-italic", className)}>
      <span className={cn("block font-semibold", tone === "dark" ? "text-platinum-100" : "text-ink-900")}>{settings.clinicName}</span>
      {addressLines(settings.address).map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </address>
  );
}

export function ContactLinks({ settings, tone = "light" }: { settings: PublicClinicSettings } & Tone) {
  const linkClass = cn(
    "inline-flex min-h-11 items-center gap-3 underline-offset-4 hover:underline",
    tone === "dark" ? "text-platinum-100" : "text-ink-900",
  );
  return (
    <ul className="space-y-1">
      <li>
        <a href={telHref(settings.phoneE164)} className={linkClass}>
          <Phone aria-hidden="true" className="size-5" />
          <span>
            <span className="sr-only">Phone: </span>
            {formatPhoneDisplay(settings.phoneE164)}
          </span>
        </a>
      </li>
      {settings.whatsappE164 ? (
        <li>
          <a href={whatsappHref(settings.whatsappE164)} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <MessageCircle aria-hidden="true" className="size-5" />
            <span>
              WhatsApp {formatPhoneDisplay(settings.whatsappE164)}
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          </a>
        </li>
      ) : null}
      <li>
        <a href={directionsUrl(settings)} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <MapPin aria-hidden="true" className="size-5" />
          <span>
            Get directions<span className="sr-only"> (opens Google Maps in a new tab)</span>
          </span>
        </a>
      </li>
    </ul>
  );
}

/**
 * Opening hours, shown only once the clinic has configured them. Until then we
 * ask visitors to call rather than display invented timings.
 */
export function OpeningHours({ settings, tone = "light" }: { settings: PublicClinicSettings } & Tone) {
  if (!hasOpeningHours(settings.weeklyHours)) {
    return (
      <p className={tone === "dark" ? "text-silver-300" : "text-graphite-600"}>
        Please call {formatPhoneDisplay(settings.phoneE164)} to check clinic timings before your visit.
      </p>
    );
  }
  return (
    <table className="w-full text-left">
      <caption className="sr-only">Opening hours</caption>
      <tbody>
        {openingHoursRows(settings.weeklyHours).map((row) => (
          <tr key={row.day} className={cn("border-b", tone === "dark" ? "border-ink-700" : "border-silver-200")}>
            <th scope="row" className="py-2 pr-4 font-medium">
              {row.day}
            </th>
            <td className="py-2">
              {row.hours.split(", ").map((range) => (
                <span key={range} className="block whitespace-nowrap">
                  {range}
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
