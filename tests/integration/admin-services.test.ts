// @vitest-environment node
import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  addAppointmentNote,
  appointmentListQuerySchema,
  createManualAppointment,
  dashboardSummary,
  exportAppointmentsCsv,
  getAppointmentDetail,
  listAppointments,
  staffSlots,
} from "@/features/appointments/admin";
import { changeAppointmentStatus } from "@/features/appointments/service";
import { getAdminSettings } from "@/features/clinic-settings/repository";
import { createClosure, createSlotBlock, deleteSlotBlock, getScheduleDay } from "@/features/schedule/service";
import { deleteService, getService, listAllServices, updateService } from "@/features/services/admin";
import { AppointmentModel, ClinicSettingsModel, ServiceModel, SlotHoldModel } from "@/lib/db/models";
import { addDays, fromLocal, toLocalDate, weekdayOf } from "@/lib/time/ist";

import { DEV_SAMPLE_WEEKLY_HOURS } from "../../scripts/lib/database";
import { setupTestDatabase } from "../support/mongo";

setupTestDatabase({ seed: true });

/** Next Tuesday at least 2 days away, so tests never depend on the current time of day. */
function nextWorkingDay(): string {
  let d = addDays(toLocalDate(new Date()), 2);
  while (weekdayOf(d) !== "tue") d = addDays(d, 1);
  return d;
}

const actor = { id: undefined, email: "owner@example.com" } as const;
let DAY: string;
let phone = 0;

async function manual(time: string, overrides: Partial<Parameters<typeof createManualAppointment>[0]> = {}) {
  phone++;
  return createManualAppointment(
    {
      patient: { name: "Phone Patient", phone: `+9191111${String(10000 + phone).slice(-5)}`, email: undefined },
      service: "dental-consultation",
      start: fromLocal(DAY, time).toISOString(),
      message: undefined,
      source: "phone",
      status: "confirmed",
      notifyPatient: false,
      idempotencyKey: randomUUID(),
      ...overrides,
    },
    actor,
  );
}

beforeEach(async () => {
  await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { weeklyHours: DEV_SAMPLE_WEEKLY_HOURS } });
  DAY = nextWorkingDay();
});

describe("manual appointments and listing", () => {
  it("creates staff bookings, lists, filters and searches them", async () => {
    const { appointment } = await manual("10:00");
    await manual("11:00", { patient: { name: "Ravi Kumar", phone: "+919876500001", email: undefined }, status: "pending" });
    expect(appointment).toMatchObject({ source: "phone", status: "confirmed" });

    const all = await listAppointments(appointmentListQuerySchema.parse({}));
    expect(all.page.total).toBe(2);
    expect(all.items[0].phoneMasked).toMatch(/^\+91\*+\d{4}$/);

    expect((await listAppointments(appointmentListQuerySchema.parse({ status: "pending" }))).page.total).toBe(1);
    expect((await listAppointments(appointmentListQuerySchema.parse({ q: "ravi" }))).items[0].patientName).toBe("Ravi Kumar");
    expect((await listAppointments(appointmentListQuerySchema.parse({ q: "500001" }))).page.total).toBe(1);
    expect((await listAppointments(appointmentListQuerySchema.parse({ q: appointment.reference }))).page.total).toBe(1);
    expect((await listAppointments(appointmentListQuerySchema.parse({ from: DAY, to: DAY }))).page.total).toBe(2);
  });

  it("notes, details and dashboard counts come from real records", async () => {
    const { appointment } = await manual("10:00", { status: "pending" });
    await addAppointmentNote({ appointmentId: String(appointment._id), text: "Prefers mornings", actor });
    const detail = await getAppointmentDetail(String(appointment._id));
    expect(detail.appointment.internalNotes[0].text).toBe("Prefers mornings");

    const summary = await dashboardSummary();
    expect(summary.counts.pending).toBe(1);
    expect(summary.upcoming.map((u) => u.id)).toContain(String(appointment._id));
  });

  it("offers staff slots that exclude taken times and reuse an appointment's own slot when rescheduling", async () => {
    const { appointment } = await manual("10:00");
    const slots = await staffSlots({ service: "dental-consultation", date: DAY });
    expect(slots.slots.map((s) => s.label)).not.toContain("10:00 AM");
    const forReschedule = await staffSlots({ date: DAY, excludeAppointmentId: String(appointment._id) });
    expect(forReschedule.slots.map((s) => s.label)).toContain("10:00 AM");
  });

  it("exports a formula-safe CSV with minimal fields", async () => {
    const { appointment } = await manual("10:00");
    // Simulate a hostile value already stored (the API itself rejects such names).
    await AppointmentModel.updateOne({ _id: appointment._id }, { $set: { "patient.name": "=HYPERLINK(evil)" } });
    const csv = await exportAppointmentsCsv({ from: DAY, to: DAY, status: [] });
    const [header, row] = csv.trim().split(/\r?\n/);
    expect(header).toBe('"Reference","Date","Time","Service","Patient name","Mobile","Status"');
    expect(row).toContain(`"'=HYPERLINK(evil)"`);
    expect(row).not.toContain("internal");
    await expect(exportAppointmentsCsv({ from: DAY, to: addDays(DAY, 120), status: [] })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

describe("schedule: blocks and closures", () => {
  it("blocks free time, refuses blocks over bookings, and releases on delete", async () => {
    const block = await createSlotBlock({ date: DAY, startTime: "16:00", endTime: "17:00", resourceKey: "all", reason: "Staff meeting" }, actor);
    expect(await SlotHoldModel.countDocuments({ holderType: "block" })).toBe(2);
    const day = await getScheduleDay(DAY);
    expect(day.cells.find((c) => c.label === "4:00 PM")?.state).toBe("block");
    // A blocked time is taken, so booking it is a 409 conflict, not a validation error.
    await expect(manual("16:00")).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });

    await manual("10:00");
    await expect(createSlotBlock({ date: DAY, startTime: "10:00", endTime: "10:30", resourceKey: "all", reason: "x-ray service" }, actor)).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
      details: { conflicts: [expect.objectContaining({ patientName: "Phone Patient" })] },
    });

    await deleteSlotBlock(block.id, actor);
    expect(await SlotHoldModel.countDocuments({ holderType: "block" })).toBe(0);
    await expect(manual("16:00")).resolves.toBeTruthy();
  });

  it("rejects off-grid blocks", async () => {
    await expect(createSlotBlock({ date: DAY, startTime: "10:10", endTime: "10:40", resourceKey: "all", reason: "Odd" }, actor)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("lists appointments affected by a new closure without cancelling them", async () => {
    await manual("10:00");
    await manual("17:00");
    const all = await createClosure({ startDate: DAY, endDate: DAY, allDay: true, reason: "Holiday" }, actor);
    expect(all.affectedAppointments).toHaveLength(2);
    const partial = await createClosure({ startDate: DAY, endDate: DAY, allDay: false, startTime: "09:00", endTime: "12:00", reason: "Training" }, actor);
    expect(partial.affectedAppointments).toHaveLength(1);
    expect(await AppointmentModel.countDocuments({ status: "confirmed" })).toBe(2);
    expect((await getScheduleDay(DAY)).closedAllDay).toBe(true);
  });

  it("cancelling releases the slot in the schedule", async () => {
    const { appointment } = await manual("10:00");
    await changeAppointmentStatus({ appointmentId: String(appointment._id), to: "cancelled", actor });
    expect((await getScheduleDay(DAY)).cells.find((c) => c.label === "10:00 AM")?.state).toBe("free");
  });
});

describe("services and settings administration", () => {
  it("keeps the old address for redirects when a slug changes", async () => {
    const consultation = (await listAllServices()).find((s) => s.slug === "dental-consultation")!;
    const updated = await updateService(consultation.id, { ...consultation, slug: "dental-check-up", title: "Dental Check-up" }, actor);
    expect(updated.redirectFrom).toEqual(["dental-consultation"]);
    expect((await getService(consultation.id)).title).toBe("Dental Check-up");
  });

  it("refuses to delete a service that has appointments", async () => {
    await manual("10:00");
    const consultation = await ServiceModel.findOne({ slug: "dental-consultation" }).lean();
    await expect(deleteService(String(consultation!._id), actor)).rejects.toMatchObject({ code: "CONFLICT" });
    const draft = await ServiceModel.findOne({ slug: "teeth-whitening" }).lean();
    await expect(deleteService(String(draft!._id), actor)).resolves.toBeUndefined();
  });

  it("returns editable settings with their version", async () => {
    const settings = await getAdminSettings();
    expect(settings).toMatchObject({ clinicName: "NAV Dental Clinic", version: 1, bookingMode: "request" });
    expect(settings.weeklyHours.tue).toHaveLength(2);
  });
});
