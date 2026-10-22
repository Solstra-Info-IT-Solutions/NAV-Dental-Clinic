// @vitest-environment node
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import { findSettings, seedSettings } from "@/features/clinic-settings/repository";
import { findPublishedServices, seedServices } from "@/features/services/repository";
import { AppointmentModel, AuditLogModel, ClinicSettingsModel, ServiceModel, SlotHoldModel } from "@/lib/db/models";
import { isDuplicateKeyError } from "@/lib/errors";

import { initialiseDatabase } from "../../scripts/lib/database";
import { setupTestDatabase } from "../support/mongo";

const { mongoose } = setupTestDatabase();

async function indexesOf(collection: string) {
  return mongoose.connection.db!.collection(collection).indexes();
}

describe("database initialisation", () => {
  it("creates every collection with the documented indexes", async () => {
    const holds = await indexesOf("slot_holds");
    expect(holds).toContainEqual(expect.objectContaining({ key: { resourceKey: 1, start: 1 }, unique: true }));

    const appointments = await indexesOf("appointments");
    expect(appointments).toContainEqual(expect.objectContaining({ key: { reference: 1 }, unique: true }));
    expect(appointments).toContainEqual(
      expect.objectContaining({ key: { idempotencyKey: 1 }, unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } }),
    );

    const rateLimits = await indexesOf("rate_limits");
    expect(rateLimits).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }));

    const enquiries = await indexesOf("enquiries");
    expect(enquiries).toContainEqual(expect.objectContaining({ key: { spamExpiresAt: 1 }, expireAfterSeconds: 0 }));

    const services = await indexesOf("services");
    expect(services).toContainEqual(expect.objectContaining({ key: { slug: 1 }, unique: true }));
  });

  it("seeds settings and services once and never overwrites edits", async () => {
    expect(await seedSettings()).toEqual({ created: true });
    expect(await seedServices()).toEqual({ inserted: 13 });

    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { doctorCredentials: "BDS" } });
    await ServiceModel.updateOne({ slug: "dental-consultation" }, { $set: { title: "Consultation (edited)" } });

    const second = await initialiseDatabase();
    expect(second.settingsCreated).toBe(false);
    expect(second.servicesInserted).toBe(0);
    expect((await findSettings())?.doctorCredentials).toBe("BDS");
    expect((await ServiceModel.findOne({ slug: "dental-consultation" }).lean())?.title).toBe("Consultation (edited)");
  });

  it("exposes only published services", async () => {
    await seedServices();
    expect((await findPublishedServices()).map((s) => s.slug)).toEqual(["dental-consultation"]);
  });

  it("stores the verified clinic details in settings", async () => {
    await seedSettings();
    const settings = await findSettings();
    expect(settings).toMatchObject({
      clinicName: "NAV Dental Clinic",
      doctorName: "Dr. Ratan Raghav",
      phoneE164: "+918006606001",
      bookingMode: "request",
      slotMinutes: 30,
      capacity: 1,
      minNoticeMinutes: 120,
      maxAdvanceDays: 30,
      whatsappEnabled: false,
      version: 1,
    });
    expect(settings?.weeklyHours?.mon).toEqual([]);
  });
});

describe("slot hold guard", () => {
  const start = new Date("2026-11-03T04:30:00.000Z");

  it("rejects a second hold for the same chair and time", async () => {
    await SlotHoldModel.create({ resourceKey: "chair-1", start, holderType: "appointment", holderId: new Types.ObjectId() });
    const error = await SlotHoldModel.create({ resourceKey: "chair-1", start, holderType: "appointment", holderId: new Types.ObjectId() }).catch(
      (e: unknown) => e,
    );
    expect(isDuplicateKeyError(error, "resourceKey")).toBe(true);
    // A different chair at the same time is allowed (capacity > 1).
    await expect(
      SlotHoldModel.create({ resourceKey: "chair-2", start, holderType: "appointment", holderId: new Types.ObjectId() }),
    ).resolves.toBeTruthy();
  });

  it("lets exactly one of many concurrent transactions take a slot", async () => {
    const attempts = Array.from({ length: 8 }, async () => {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const holderId = new Types.ObjectId();
          await SlotHoldModel.create([{ resourceKey: "chair-1", start, holderType: "appointment", holderId }], { session });
        });
        return "committed";
      } catch (error) {
        return isDuplicateKeyError(error) ? "conflict" : `unexpected: ${String(error)}`;
      } finally {
        await session.endSession();
      }
    });
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r === "committed")).toHaveLength(1);
    expect(results.filter((r) => r === "conflict")).toHaveLength(7);
    expect(await SlotHoldModel.countDocuments({ start })).toBe(1);
  });
});

describe("model validation", () => {
  it("rejects malformed appointment references and phone numbers", async () => {
    const doc = new AppointmentModel({
      reference: "NAV-1",
      patient: { name: "A", phoneE164: "8006606001" },
      serviceId: new Types.ObjectId(),
      serviceTitle: "Dental Consultation",
      start: new Date(),
      end: new Date(),
      localDate: "2026-11-03",
      resourceKey: "chair-1",
      consent: { privacyAcknowledgedAt: new Date(), policyVersion: "2026-10-22" },
      source: "web",
    });
    const error = (await doc.validate().catch((e: unknown) => e)) as { errors?: Record<string, unknown> } | undefined;
    expect(Object.keys(error?.errors ?? {})).toEqual(expect.arrayContaining(["reference", "patient.name", "patient.phoneE164"]));
  });

  it("keeps audit logs append-only", async () => {
    await AuditLogModel.create({ action: "test", entity: "x", entityId: "1" });
    await expect(AuditLogModel.updateOne({ entity: "x" }, { $set: { action: "changed" } })).rejects.toThrow(/append-only/);
    await expect(AuditLogModel.deleteMany({})).rejects.toThrow(/append-only/);
  });
});
