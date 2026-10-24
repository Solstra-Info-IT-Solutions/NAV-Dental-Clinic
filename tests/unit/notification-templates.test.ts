import { describe, expect, it } from "vitest";

import { patientAppointmentEmail, staffNewAppointmentEmail, type AppointmentEvent } from "@/features/notifications/templates";
import { fromLocal } from "@/lib/time/ist";

const clinic = { clinicName: "NAV Dental Clinic", phoneE164: "+918006606001", addressLine: "Somna Road, Pahasu" };
const base = {
  reference: "NAV-K7Q2-M9XD-4T",
  serviceTitle: "Dental Consultation",
  start: fromLocal("2026-11-03", "16:30"),
  status: "pending",
  patientName: "Asha Verma",
  patientPhoneE164: "+919876543210",
  source: "web",
};

describe("patient emails for every appointment event", () => {
  const expectations: Record<AppointmentEvent, { subject: RegExp; body: RegExp }> = {
    received: { subject: /We received your appointment request – NAV-K7Q2-M9XD-4T/, body: /not yet a confirmed appointment/ },
    confirmed: { subject: /Appointment confirmed/, body: /Your appointment is confirmed/ },
    rescheduled: { subject: /Appointment time changed/, body: /New time: Tuesday, 3 November 2026 at 4:30 PM/ },
    cancelled: { subject: /Appointment cancelled/, body: /has been cancelled/ },
    rejected: { subject: /About your appointment request/, body: /cannot offer the time you requested/ },
  };

  for (const [event, expected] of Object.entries(expectations) as [AppointmentEvent, { subject: RegExp; body: RegExp }][]) {
    it(`${event}: clear subject, IST time, reference and the clinic's phone`, () => {
      const email = patientAppointmentEmail(event, base, clinic);
      expect(email.subject).toMatch(expected.subject);
      expect(email.text).toMatch(expected.body);
      expect(email.text).toContain("Dear Asha Verma");
      expect(email.text).toContain("+91 80066 06001");
      expect(email.html).toContain("<!doctype html>");
      // Patients never receive their own phone number or internal data back.
      expect(email.text).not.toContain("98765");
    });
  }

  it("instant bookings say booked, never 'request'", () => {
    const email = patientAppointmentEmail("received", { ...base, status: "confirmed" }, clinic);
    expect(email.subject).toMatch(/^Appointment booked/);
    expect(email.text).not.toMatch(/not yet a confirmed/);
  });

  it("staff alert tells staff to confirm request-mode bookings and links to the admin", () => {
    const email = staffNewAppointmentEmail(base, clinic, "https://nav.example/admin/appointments");
    expect(email.text).toContain("Please review it and contact the patient to confirm.");
    expect(email.text).toContain("Mobile: +91 98765 43210");
    expect(email.text).toContain("https://nav.example/admin/appointments");
  });
});
