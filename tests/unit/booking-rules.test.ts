import { describe, expect, it } from "vitest";

import { generateReference } from "@/features/appointments/reference";
import { appointmentRequestSchema, bookingFormSchema, normaliseIndianMobile, normaliseReference } from "@/features/appointments/schemas";
import { spamReason } from "@/features/appointments/spam";
import { checkTransition, holdsSlot, TRANSITIONS } from "@/features/appointments/status-machine";
import { escapeHtml, patientAppointmentEmail, staffNewAppointmentEmail } from "@/features/notifications/templates";
import { fromLocal } from "@/lib/time/ist";

describe("mobile number normalisation", () => {
  it.each([
    ["8006606001", "+918006606001"],
    ["+91 80066 06001", "+918006606001"],
    ["91-8006606001", "+918006606001"],
    ["08006606001", "+918006606001"],
    ["(800) 660-6001", "+918006606001"],
  ])("accepts %s", (input, expected) => expect(normaliseIndianMobile(input)).toBe(expected));

  it.each(["5006606001", "800660600", "80066060011", "+14155550100", "abcdefghij"])("rejects %s", (input) => {
    expect(normaliseIndianMobile(input)).toBeNull();
  });
});

describe("booking references", () => {
  it("are random, readable and match the stored format", () => {
    const refs = new Set(Array.from({ length: 2000 }, generateReference));
    expect(refs.size).toBe(2000);
    for (const ref of refs) expect(ref).toMatch(/^NAV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/);
  });

  it("normalises user-typed references", () => {
    expect(normaliseReference(" nav-k7q2-m9xd-4t ")).toBe("NAV-K7Q2-M9XD-4T");
    expect(normaliseReference("NAVK7Q2M9XD4T")).toBe("NAV-K7Q2-M9XD-4T");
    expect(normaliseReference("NAV-K7Q2-M9XD-4I")).toBeNull(); // I is not in the alphabet
    expect(normaliseReference("NAV-123")).toBeNull();
  });
});

describe("appointment request schema", () => {
  const valid = {
    idempotencyKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
    patient: { name: "Asha Verma", phone: "80066 06001", email: "" },
    service: "dental-consultation",
    start: "2026-11-03T04:30:00.000Z",
    privacyAcknowledged: true,
    policyVersion: "2026-10-22-draft",
    formStartedAt: 1,
  };

  it("normalises fields and treats an empty email as absent", () => {
    const parsed = appointmentRequestSchema.parse(valid);
    expect(parsed.patient).toEqual({ name: "Asha Verma", phone: "+918006606001", email: undefined });
    expect(parsed.marketingOptIn).toBe(false);
  });

  it("accepts Hindi names and rejects markup", () => {
    expect(appointmentRequestSchema.safeParse({ ...valid, patient: { ...valid.patient, name: "आशा वर्मा" } }).success).toBe(true);
    expect(appointmentRequestSchema.safeParse({ ...valid, patient: { ...valid.patient, name: "<script>x</script>" } }).success).toBe(false);
  });

  it("requires privacy acknowledgement and limits the message", () => {
    expect(appointmentRequestSchema.safeParse({ ...valid, privacyAcknowledged: false }).success).toBe(false);
    expect(appointmentRequestSchema.safeParse({ ...valid, message: "x".repeat(501) }).success).toBe(false);
  });

  it("reports missing form choices with patient-friendly messages", () => {
    const result = bookingFormSchema.safeParse({ service: "", date: "", start: "", name: "", phone: "", privacyAcknowledged: false, marketingOptIn: false, hp: "" });
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toEqual(expect.arrayContaining(["Choose the type of visit.", "Choose a date.", "Choose a time.", "Please confirm you have read the privacy notice."]));
  });
});

describe("spam signals", () => {
  const now = 1_000_000;
  it("flags honeypot, too-fast and stale submissions", () => {
    expect(spamReason({ honeypot: "http://spam", formStartedAt: now - 60_000, now })).toBe("honeypot");
    expect(spamReason({ honeypot: "", formStartedAt: now - 1_000, now })).toBe("too_fast");
    expect(spamReason({ honeypot: "", formStartedAt: now - 2 * 86_400_000, now })).toBe("stale_form");
    expect(spamReason({ honeypot: "", formStartedAt: now - 45_000, now })).toBeNull();
  });
});

describe("status machine", () => {
  const start = fromLocal("2026-11-03", "10:00");
  const before = fromLocal("2026-11-03", "09:00");
  const after = fromLocal("2026-11-03", "11:00");

  it("allows the documented transitions only", () => {
    expect(checkTransition("pending", "confirmed", { start, now: before }).ok).toBe(true);
    expect(checkTransition("pending", "completed", { start, now: after }).ok).toBe(false);
    expect(checkTransition("cancelled", "confirmed", { start, now: before }).ok).toBe(false);
    expect(checkTransition("confirmed", "confirmed", { start, now: before }).ok).toBe(false);
  });

  it("only allows completed/no-show after the start time", () => {
    expect(checkTransition("confirmed", "completed", { start, now: before }).ok).toBe(false);
    expect(checkTransition("confirmed", "completed", { start, now: after }).ok).toBe(true);
    expect(checkTransition("confirmed", "no_show", { start, now: after }).ok).toBe(true);
  });

  it("has no exits from terminal statuses and releases slots for cancelled/rejected/no-show", () => {
    for (const terminal of ["completed", "cancelled", "rejected", "no_show"] as const) expect(Object.keys(TRANSITIONS[terminal])).toEqual([]);
    expect(["pending", "confirmed", "reschedule_requested", "completed"].every((s) => holdsSlot(s as never))).toBe(true);
    expect(["cancelled", "rejected", "no_show"].some((s) => holdsSlot(s as never))).toBe(false);
  });
});

describe("notification templates", () => {
  const clinic = { clinicName: "NAV Dental Clinic", phoneE164: "+918006606001", addressLine: "Somna Road, Pahasu" };
  const appointment = {
    reference: "NAV-K7Q2-M9XD-4T",
    serviceTitle: "Dental Consultation",
    start: fromLocal("2026-11-03", "10:00"),
    status: "pending",
    patientName: "Asha <b>Verma</b>",
    patientPhoneE164: "+918006606001",
    source: "web",
  };

  it("never claims a request-mode booking is confirmed", () => {
    const email = patientAppointmentEmail("received", appointment, clinic);
    expect(email.text).toContain("This is not yet a confirmed appointment");
    expect(email.subject).not.toMatch(/confirmed/i);
    expect(email.text).toContain("10:00 AM");
  });

  it("escapes HTML from user-provided values", () => {
    const email = staffNewAppointmentEmail({ ...appointment, message: '<img src=x onerror="alert(1)">' }, clinic, "https://example.com/admin");
    expect(email.html).not.toContain("<b>Verma</b>");
    expect(email.html).not.toContain("<img");
    expect(escapeHtml(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;");
  });
});
