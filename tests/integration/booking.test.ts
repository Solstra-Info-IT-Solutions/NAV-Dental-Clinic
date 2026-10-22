// @vitest-environment node
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AppointmentRequest } from "@/features/appointments/schemas";
import {
  availableDates,
  availableSlots,
  changeAppointmentStatus,
  createWebAppointment,
  lookupAppointmentStatus,
  rescheduleAppointment,
} from "@/features/appointments/service";
import { setEmailProviderForTests, type EmailProvider, EmailProviderError } from "@/features/notifications/email-provider";
import { notifyAppointmentEvent, processDueNotifications } from "@/features/notifications/service";
import { AppointmentModel, AuditLogModel, ClinicSettingsModel, ClosureModel, NotificationAttemptModel, SlotHoldModel } from "@/lib/db/models";
import { AppError } from "@/lib/errors";
import { fromLocal } from "@/lib/time/ist";

import { DEV_SAMPLE_WEEKLY_HOURS } from "../../scripts/lib/database";
import { setupTestDatabase } from "../support/mongo";

setupTestDatabase({ seed: true });

// Monday 2 Nov 2026 09:00 IST; Tuesday 3 Nov is a sample working day.
const now = fromLocal("2026-11-02", "09:00");
const DAY = "2026-11-03";
const TEN = fromLocal(DAY, "10:00");

let phoneCounter = 0;
function request(overrides: Partial<AppointmentRequest> = {}): AppointmentRequest {
  phoneCounter++;
  return {
    idempotencyKey: randomUUID(),
    patient: { name: "Test Patient", phone: `+9190000${String(10000 + phoneCounter).slice(-5)}`, email: "patient@example.com" },
    service: "dental-consultation",
    start: TEN.toISOString(),
    message: undefined,
    privacyAcknowledged: true,
    marketingOptIn: false,
    policyVersion: "2026-10-22-draft",
    hp: "",
    formStartedAt: 0,
    ...overrides,
  };
}

async function book(overrides: Partial<AppointmentRequest> = {}) {
  return createWebAppointment(request(overrides), { now });
}

beforeEach(async () => {
  await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { weeklyHours: DEV_SAMPLE_WEEKLY_HOURS } });
  setEmailProviderForTests(null);
});

afterEach(() => setEmailProviderForTests(undefined));

describe("availability APIs", () => {
  it("lists available dates and slots from live rules", async () => {
    const dates = await availableDates("dental-consultation", { days: 7, now });
    expect(dates.from).toBe("2026-11-02");
    expect(dates.dates.find((d) => d.date === "2026-11-08")?.available).toBe(false); // Sunday
    expect(dates.dates.find((d) => d.date === DAY)?.available).toBe(true);

    const slots = await availableSlots("dental-consultation", DAY, now);
    expect(slots.slots[0]).toEqual({ start: TEN.toISOString(), label: "10:00 AM" });
    expect(slots.slots).toHaveLength(15); // 7 morning + 8 evening half-hour slots
  });

  it("is disabled until opening hours are configured", async () => {
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { weeklyHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } } });
    await expect(availableSlots("dental-consultation", DAY, now)).rejects.toMatchObject({ code: "BOOKING_DISABLED" });
    await expect(book()).rejects.toMatchObject({ code: "BOOKING_DISABLED" });
  });

  it("rejects unpublished services", async () => {
    await expect(availableSlots("teeth-whitening", DAY, now)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(book({ service: "teeth-whitening" })).rejects.toMatchObject({ code: "VALIDATION_FAILED", fields: { service: expect.any(String) } });
  });
});

describe("creating appointments", () => {
  it("persists a pending request with a hold, reference and history", async () => {
    const { appointment, replayed } = await book();
    expect(replayed).toBe(false);
    expect(appointment).toMatchObject({ status: "pending", localDate: DAY, resourceKey: "chair-1", holdsSlot: true, source: "web" });
    expect(appointment.reference).toMatch(/^NAV-/);
    expect(appointment.history[0]).toMatchObject({ to: "pending", action: "requested_online" });
    expect(await SlotHoldModel.countDocuments({ holderId: appointment._id })).toBe(1);
    expect((await availableSlots("dental-consultation", DAY, now)).slots.map((s) => s.start)).not.toContain(TEN.toISOString());
  });

  it("confirms immediately in instant booking mode", async () => {
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { bookingMode: "instant" } });
    expect((await book()).appointment.status).toBe("confirmed");
  });

  it("rejects past, off-grid, closed and out-of-window times with 422", async () => {
    for (const start of [fromLocal("2026-11-02", "08:00"), fromLocal(DAY, "10:10"), fromLocal(DAY, "14:00"), fromLocal("2026-11-08", "10:00"), fromLocal("2026-12-15", "10:00")]) {
      await expect(book({ start: start.toISOString() })).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 422 });
    }
    // Inside the 2-hour minimum notice
    await expect(createWebAppointment(request({ start: fromLocal("2026-11-02", "10:30").toISOString() }), { now })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(await AppointmentModel.countDocuments()).toBe(0);
  });

  it("honours holiday closures", async () => {
    await ClosureModel.create({ startDate: DAY, endDate: DAY, allDay: true, reason: "Holiday" });
    await expect(book()).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("returns 409 with alternatives when the slot is already taken", async () => {
    await book();
    const error = await book().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("SLOT_UNAVAILABLE");
    const alternatives = (error as AppError).details?.alternatives as { start: string; label: string }[];
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives[0]).toMatchObject({ label: "10:30 AM", date: DAY });
  });

  it("replays an idempotent retry instead of creating a duplicate", async () => {
    const body = request();
    const first = await createWebAppointment(body, { now });
    const second = await createWebAppointment(body, { now });
    expect(second.replayed).toBe(true);
    expect(second.appointment.reference).toBe(first.appointment.reference);
    expect(await AppointmentModel.countDocuments()).toBe(1);
  });
});

describe("concurrency", () => {
  it("lets exactly one of ten simultaneous patients take the same slot", async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => book()));
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected.every((r) => r.reason instanceof AppError && r.reason.code === "SLOT_UNAVAILABLE")).toBe(true);
    expect(await AppointmentModel.countDocuments()).toBe(1);
    expect(await SlotHoldModel.countDocuments({ start: TEN })).toBe(1);
  });

  it("treats simultaneous duplicate submissions as one booking", async () => {
    const body = request();
    const results = await Promise.all(Array.from({ length: 5 }, () => createWebAppointment(body, { now })));
    expect(new Set(results.map((r) => r.appointment.reference)).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await AppointmentModel.countDocuments()).toBe(1);
  });

  it("fills every chair before refusing when capacity is greater than one", async () => {
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { capacity: 2 } });
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => book()));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(new Set((await SlotHoldModel.find({ start: TEN }).lean()).map((h) => h.resourceKey))).toEqual(new Set(["chair-1", "chair-2"]));
  });
});

describe("status changes and rescheduling", () => {
  it("confirms, audits and blocks invalid transitions", async () => {
    const { appointment } = await book();
    const confirmed = await changeAppointmentStatus({ appointmentId: String(appointment._id), to: "confirmed", actor: "system", now });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.history.at(-1)).toMatchObject({ from: "pending", to: "confirmed" });
    expect(await AuditLogModel.countDocuments({ action: "appointment.status_changed" })).toBe(1);

    await expect(changeAppointmentStatus({ appointmentId: String(appointment._id), to: "completed", actor: "system", now })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("releases the slot when cancelled so it can be booked again", async () => {
    const { appointment } = await book();
    await changeAppointmentStatus({ appointmentId: String(appointment._id), to: "cancelled", actor: "system", now });
    expect(await SlotHoldModel.countDocuments({ holderId: appointment._id })).toBe(0);
    expect((await AppointmentModel.findById(appointment._id).lean())?.holdsSlot).toBe(false);
    await expect(book()).resolves.toMatchObject({ replayed: false });
  });

  it("moves holds atomically on reschedule and refuses taken times", async () => {
    const { appointment } = await book();
    const other = await book({ start: fromLocal(DAY, "11:00").toISOString() });

    const moved = await rescheduleAppointment({ appointmentId: String(appointment._id), start: fromLocal(DAY, "16:00"), actor: "system", now });
    expect(moved).toMatchObject({ status: "confirmed", localDate: DAY });
    const holds = await SlotHoldModel.find({ holderId: appointment._id }).lean();
    expect(holds.map((h) => h.start.toISOString())).toEqual([fromLocal(DAY, "16:00").toISOString()]);

    await expect(
      rescheduleAppointment({ appointmentId: String(appointment._id), start: other.appointment.start, actor: "system", now }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    // The original 10:00 slot is free again
    expect((await availableSlots("dental-consultation", DAY, now)).slots.map((s) => s.start)).toContain(TEN.toISOString());
  });
});

describe("public status lookup", () => {
  it("requires both reference and mobile number, revealing only minimal fields", async () => {
    const { appointment } = await book();
    const status = await lookupAppointmentStatus(appointment.reference, appointment.patient.phoneE164);
    expect(Object.keys(status).sort()).toEqual(["reference", "serviceTitle", "start", "status"]);

    const wrongPhone = await lookupAppointmentStatus(appointment.reference, "+919999999999").catch((e: unknown) => e);
    const unknownRef = await lookupAppointmentStatus("NAV-0000-0000-00", appointment.patient.phoneE164).catch((e: unknown) => e);
    expect(wrongPhone).toMatchObject({ code: "NOT_FOUND" });
    expect((wrongPhone as AppError).message).toBe((unknownRef as AppError).message);
  });
});

describe("notifications", () => {
  function provider(behaviour: "ok" | "retryable" | "permanent"): EmailProvider & { sent: number } {
    return {
      name: "fake",
      sent: 0,
      async send() {
        if (behaviour === "retryable") throw new EmailProviderError("503 from provider", true);
        if (behaviour === "permanent") throw new EmailProviderError("422 invalid recipient", false);
        this.sent++;
        return { id: `msg_${this.sent}` };
      },
    };
  }

  it("records skipped_not_configured when no email provider is set up", async () => {
    const { appointment } = await book();
    await notifyAppointmentEvent(appointment._id, "received");
    const attempts = await NotificationAttemptModel.find({ subjectId: appointment._id }).lean();
    expect(attempts.map((a) => a.status)).toEqual(["skipped_not_configured"]);
    expect(attempts[0].recipientMasked).toBe("p***@example.com");
  });

  it("keeps the booking and schedules a retry when sending fails, then sends on retry", async () => {
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { "notifications.staffEmails": ["staff@example.com"] } });
    setEmailProviderForTests(provider("retryable"));
    const { appointment } = await book();
    await notifyAppointmentEvent(appointment._id, "received");

    const failed = await NotificationAttemptModel.find({ subjectId: appointment._id }).lean();
    expect(failed.map((a) => a.kind).sort()).toEqual(["appointment_received", "staff_new_appointment"]);
    expect(failed.every((a) => a.status === "failed" && a.attempts === 1 && a.nextRetryAt)).toBe(true);
    expect(await AppointmentModel.countDocuments({ _id: appointment._id })).toBe(1);

    const working = provider("ok");
    setEmailProviderForTests(working);
    const totals = await processDueNotifications(new Date(Date.now() + 10 * 60_000));
    expect(totals).toMatchObject({ processed: 2, sent: 2 });
    expect(working.sent).toBe(2);
  });

  it("abandons non-retryable failures", async () => {
    setEmailProviderForTests(provider("permanent"));
    const { appointment } = await book();
    await notifyAppointmentEvent(appointment._id, "received");
    expect((await NotificationAttemptModel.findOne({ subjectId: appointment._id }).lean())?.status).toBe("abandoned");
  });

  it("does not email patients who gave no email address", async () => {
    const { appointment } = await book({ patient: { name: "No Email", phone: "+919811111111", email: undefined } });
    await notifyAppointmentEvent(appointment._id, "received");
    expect(await NotificationAttemptModel.countDocuments({ subjectId: appointment._id })).toBe(0);
  });
});
