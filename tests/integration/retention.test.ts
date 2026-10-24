// @vitest-environment node
import { describe, expect, it } from "vitest";

import { purgeExpiredData } from "@/features/retention/service";
import { AppointmentModel, AuditLogModel, EnquiryModel, NotificationAttemptModel, ServiceModel, SlotHoldModel } from "@/lib/db/models";

import { setupTestDatabase } from "../support/mongo";

setupTestDatabase({ seed: true });

const now = new Date("2026-10-24T06:30:00.000Z");

async function appointment(end: Date, reference: string) {
  const service = await ServiceModel.findOne({ slug: "dental-consultation" }).lean();
  const doc = await AppointmentModel.create({
    reference,
    patient: { name: "Old Patient", phoneE164: "+919000000001" },
    serviceId: service!._id,
    serviceTitle: "Dental Consultation",
    start: new Date(end.getTime() - 30 * 60_000),
    end,
    localDate: end.toISOString().slice(0, 10),
    resourceKey: "chair-1",
    status: "completed",
    holdsSlot: true,
    consent: { privacyAcknowledgedAt: end, policyVersion: "test" },
    source: "web",
  });
  await SlotHoldModel.create({ resourceKey: "chair-1", start: doc.start, holderType: "appointment", holderId: doc._id });
  await NotificationAttemptModel.create({ kind: "appointment_received", subjectType: "appointment", subjectId: doc._id, audience: "patient", status: "sent" });
  return doc;
}

describe("data retention purge", () => {
  it("dry run reports without deleting; apply removes only expired records and audits counts", async () => {
    await appointment(new Date("2024-01-10T05:00:00.000Z"), "NAV-AAAA-AAAA-AA"); // older than 24 months
    await appointment(new Date("2026-01-10T05:00:00.000Z"), "NAV-BBBB-BBBB-BB"); // recent
    await EnquiryModel.create({ name: "Old Enquirer", phoneE164: "+919000000002", category: "general", message: "An old question here", privacyAcknowledgedAt: now });
    await EnquiryModel.collection.updateOne({}, { $set: { createdAt: new Date("2025-01-01T00:00:00.000Z") } });
    await EnquiryModel.create({ name: "New Enquirer", phoneE164: "+919000000003", category: "general", message: "A recent question here", privacyAcknowledgedAt: now });

    const dry = await purgeExpiredData({ apply: false, now });
    expect(dry).toMatchObject({ dryRun: true, appointments: 1, enquiries: 1, holds: 1, notifications: 1 });
    expect(await AppointmentModel.countDocuments()).toBe(2);

    const applied = await purgeExpiredData({ apply: true, now });
    expect(applied.dryRun).toBe(false);
    expect((await AppointmentModel.find().lean()).map((a) => a.reference)).toEqual(["NAV-BBBB-BBBB-BB"]);
    expect((await EnquiryModel.find().lean()).map((e) => e.name)).toEqual(["New Enquirer"]);
    expect(await SlotHoldModel.countDocuments()).toBe(1);
    expect(await NotificationAttemptModel.countDocuments()).toBe(1);

    const audit = await AuditLogModel.findOne({ action: "data.purged" }).lean();
    expect(audit?.changes).toEqual([
      { field: "appointments", to: 1 },
      { field: "enquiries", to: 1 },
    ]);
    expect(JSON.stringify(audit)).not.toContain("Old Patient");
  });

  it("does nothing when there is nothing to purge", async () => {
    expect(await purgeExpiredData({ apply: true, now })).toMatchObject({ appointments: 0, enquiries: 0 });
    expect(await AuditLogModel.countDocuments({ action: "data.purged" })).toBe(0);
  });
});
