import { WEEKDAYS, type ClinicAddress, type PublicClinicSettings, type Weekday } from "./types";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** "+918006606001" → "+91 80066 06001" (Indian mobile grouping). */
export function formatPhoneDisplay(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

export function telHref(e164: string): string {
  return `tel:${e164}`;
}

/** wa.me click-to-chat link. The message is optional prefilled text. */
export function whatsappHref(e164: string, message?: string): string {
  const url = new URL(`https://wa.me/${e164.replace(/^\+/, "")}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
}

export function addressLines(address: ClinicAddress): string[] {
  const region = [address.locality, address.district].filter(Boolean).join(", ");
  const state = [address.state, address.postalCode].filter(Boolean).join(" ");
  return [address.line1, address.line2, region, `${state}, India`].filter(
    (line): line is string => Boolean(line),
  );
}

export function addressOneLine(address: ClinicAddress): string {
  return addressLines(address).join(", ");
}

/**
 * Google Maps directions link. Uses the verified map URL when the clinic has
 * provided one; otherwise searches the address text (no invented coordinates).
 */
export function directionsUrl(settings: Pick<PublicClinicSettings, "mapUrl" | "clinicName" | "address">): string {
  if (settings.mapUrl) return settings.mapUrl;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${settings.clinicName}, ${addressOneLine(settings.address)}`);
  return url.toString();
}

export function hasOpeningHours(weeklyHours: PublicClinicSettings["weeklyHours"]): boolean {
  return WEEKDAYS.some((day) => weeklyHours[day].length > 0);
}

/** "16:30" → "4:30 PM" */
export function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type OpeningHoursRow = { day: string; hours: string };

export function openingHoursRows(weeklyHours: PublicClinicSettings["weeklyHours"]): OpeningHoursRow[] {
  return WEEKDAYS.map((day) => {
    const intervals = weeklyHours[day];
    return {
      day: WEEKDAY_LABELS[day],
      hours:
        intervals.length === 0
          ? "Closed"
          : intervals.map((i) => `${formatTime12h(i.open)} – ${formatTime12h(i.close)}`).join(", "),
    };
  });
}

/** Online booking is only possible once the clinic has configured hours. */
export function isOnlineBookingOpen(settings: Pick<PublicClinicSettings, "bookingEnabled" | "weeklyHours">): boolean {
  return settings.bookingEnabled && hasOpeningHours(settings.weeklyHours);
}
