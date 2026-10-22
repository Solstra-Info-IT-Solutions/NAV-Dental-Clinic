// @vitest-environment node
import { describe, expect, it } from "vitest";

import { findSettings, seedSettings, toPublicSettings, updateSettings } from "@/features/clinic-settings/repository";
import { AuditLogModel, ClinicSettingsModel, RateLimitModel } from "@/lib/db/models";
import { AppError } from "@/lib/errors";
import { consumeRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";

import { setupTestDatabase } from "../support/mongo";

setupTestDatabase();

describe("clinic settings", () => {
  it("never exposes staff emails or internal fields publicly", async () => {
    await seedSettings();
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { "notifications.staffEmails": ["staff@example.com"] } });
    const publicSettings = toPublicSettings((await findSettings())!);
    const json = JSON.stringify(publicSettings);
    expect(json).not.toContain("staff@example.com");
    expect(json).not.toContain("version");
    expect(publicSettings.whatsappE164).toBeUndefined();
  });

  it("uses the booking phone for WhatsApp once enabled without a separate number", async () => {
    await seedSettings();
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { whatsappEnabled: true } });
    expect(toPublicSettings((await findSettings())!).whatsappE164).toBe("+918006606001");
  });

  it("updates with optimistic concurrency, bumps the version and audits field names", async () => {
    await seedSettings();
    const updated = await updateSettings({
      expectedVersion: 1,
      changes: { weeklyHours: { mon: [{ open: "10:00", close: "13:30" }, { open: "16:00", close: "20:00" }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      actor: "system",
    });
    expect(updated.version).toBe(2);
    expect(updated.weeklyHours?.mon).toHaveLength(2);

    const audit = await AuditLogModel.findOne({ action: "settings.updated" }).lean();
    expect(audit?.changes.map((c) => c.field)).toEqual(["weeklyHours"]);

    await expect(updateSettings({ expectedVersion: 1, changes: { capacity: 2 }, actor: "system" })).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
  });

  it("rejects overlapping opening hours with a field-level error", async () => {
    await seedSettings();
    const error = await updateSettings({
      expectedVersion: 1,
      changes: { weeklyHours: { mon: [{ open: "10:00", close: "14:00" }, { open: "13:00", close: "18:00" }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } },
      actor: "system",
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("VALIDATION_FAILED");
    expect((error as AppError).fields).toHaveProperty(["weeklyHours.mon.1.open"]);
    expect((await findSettings())?.version).toBe(1);
  });

  it("masks contact details in audit entries", async () => {
    await seedSettings();
    await updateSettings({ expectedVersion: 1, changes: { phoneE164: "+919999999999" }, actor: "system" });
    const audit = await AuditLogModel.findOne({ action: "settings.updated" }).lean();
    expect(audit?.changes[0]).toEqual({ field: "phoneE164", from: "[changed]", to: "[changed]" });
  });
});

describe("rate limiter", () => {
  const rule = { scope: "test", limit: 3, windowSeconds: 60 };
  const now = new Date("2026-11-03T10:00:10.000Z");

  it("allows up to the limit, then blocks with a retry time", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit(rule, "1.2.3.4", now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterSeconds).toBe(50);
  });

  it("counts identifiers independently and resets in the next window", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit(rule, "a", now);
    expect((await consumeRateLimit(rule, "b", now)).allowed).toBe(true);
    expect((await consumeRateLimit(rule, "a", new Date(now.getTime() + 60_000))).allowed).toBe(true);
  });

  it("counts concurrent first requests correctly", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeRateLimit(rule, "burst", now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  it("stores only hashed identifiers", async () => {
    await consumeRateLimit(rule, "203.0.113.9", now);
    const doc = await RateLimitModel.findOne().lean();
    expect(doc?.key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(doc)).not.toContain("203.0.113.9");
  });

  it("throws RATE_LIMITED with retryAfter when enforced", async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit(rule, "x");
    await expect(enforceRateLimit(rule, "x")).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });
});
