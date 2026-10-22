import { describe, expect, it } from "vitest";

import { DEFAULT_PUBLIC_SETTINGS } from "@/features/clinic-settings/defaults";
import {
  addressLines,
  directionsUrl,
  formatPhoneDisplay,
  formatTime12h,
  hasOpeningHours,
  isOnlineBookingOpen,
  openingHoursRows,
  telHref,
  whatsappHref,
} from "@/features/clinic-settings/format";

const settings = DEFAULT_PUBLIC_SETTINGS;

describe("phone helpers", () => {
  it("formats an Indian mobile number for display", () => {
    expect(formatPhoneDisplay("+918006606001")).toBe("+91 80066 06001");
  });

  it("returns unknown formats unchanged", () => {
    expect(formatPhoneDisplay("+14155550100")).toBe("+14155550100");
  });

  it("builds tel: and wa.me links from E.164", () => {
    expect(telHref("+918006606001")).toBe("tel:+918006606001");
    expect(whatsappHref("+918006606001")).toBe("https://wa.me/918006606001");
    expect(whatsappHref("+918006606001", "Hi & hello")).toBe("https://wa.me/918006606001?text=Hi+%26+hello");
  });
});

describe("address helpers", () => {
  it("renders the verified address lines in order", () => {
    expect(addressLines(settings.address)).toEqual([
      "Somna Road",
      "Near Tata Kishan Kendra",
      "Pahasu, BSR",
      "Uttar Pradesh, India",
    ]);
  });

  it("builds a Google Maps search link when no verified map URL exists", () => {
    const url = new URL(directionsUrl(settings));
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("query")).toContain("NAV Dental Clinic, Somna Road");
  });

  it("prefers the clinic's verified map URL", () => {
    expect(directionsUrl({ ...settings, mapUrl: "https://maps.app.goo.gl/example" })).toBe("https://maps.app.goo.gl/example");
  });
});

describe("opening hours", () => {
  it("treats empty weekly hours as not configured, so online booking stays closed", () => {
    expect(hasOpeningHours(settings.weeklyHours)).toBe(false);
    expect(isOnlineBookingOpen(settings)).toBe(false);
  });

  it("opens online booking once hours exist and booking is enabled", () => {
    const withHours = { ...settings, weeklyHours: { ...settings.weeklyHours, mon: [{ open: "10:00", close: "13:00" }] } };
    expect(isOnlineBookingOpen(withHours)).toBe(true);
    expect(isOnlineBookingOpen({ ...withHours, bookingEnabled: false })).toBe(false);
  });

  it("formats times and rows in 12-hour clock with breaks", () => {
    expect(formatTime12h("00:05")).toBe("12:05 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("16:30")).toBe("4:30 PM");
    const rows = openingHoursRows({
      ...settings.weeklyHours,
      mon: [
        { open: "10:00", close: "13:30" },
        { open: "16:00", close: "20:00" },
      ],
    });
    expect(rows[0]).toEqual({ day: "Monday", hours: "10:00 AM – 1:30 PM, 4:00 PM – 8:00 PM" });
    expect(rows[6]).toEqual({ day: "Sunday", hours: "Closed" });
  });
});
