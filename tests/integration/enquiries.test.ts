// @vitest-environment node
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EnquiryRequest } from "@/features/enquiries/schemas";
import { createEnquiry, listEnquiries, updateEnquiry } from "@/features/enquiries/service";
import { setEmailProviderForTests, type EmailProvider } from "@/features/notifications/email-provider";
import { notifyEnquiryReceived } from "@/features/notifications/service";
import { AuditLogModel, ClinicSettingsModel, EnquiryModel, NotificationAttemptModel } from "@/lib/db/models";

import { setupTestDatabase } from "../support/mongo";

setupTestDatabase({ seed: true });

function enquiry(overrides: Partial<EnquiryRequest> = {}): EnquiryRequest {
  return {
    idempotencyKey: randomUUID(),
    name: "Ravi Kumar",
    phone: "+919876543210",
    email: undefined,
    category: "general",
    message: "Do you see patients on Sundays?",
    privacyAcknowledged: true,
    hp: "",
    formStartedAt: 0,
    ...overrides,
  };
}

beforeEach(() => setEmailProviderForTests(null));
afterEach(() => setEmailProviderForTests(undefined));

describe("creating enquiries", () => {
  it("persists a new enquiry with consent time and hashed metadata only", async () => {
    const { enquiry: saved, replayed, flaggedAsSpam } = await createEnquiry(enquiry(), { ipHash: "a".repeat(64), fillMs: 12_000 });
    expect(replayed).toBe(false);
    expect(flaggedAsSpam).toBe(false);
    expect(saved).toMatchObject({ status: "new", category: "general", phoneE164: "+919876543210", spam: { fillMs: 12_000, score: 0 } });
    expect(saved.privacyAcknowledgedAt).toBeInstanceOf(Date);
    expect(saved.spamExpiresAt).toBeUndefined();
  });

  it("stores suspicious content as spam with an expiry instead of discarding it", async () => {
    const { enquiry: saved, flaggedAsSpam } = await createEnquiry(enquiry({ message: "Cheap backlinks http://a.example http://b.example http://c.example" }), { fillMs: 9_000 });
    expect(flaggedAsSpam).toBe(true);
    expect(saved.status).toBe("spam");
    expect(saved.spamExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it("is idempotent, including for simultaneous duplicates", async () => {
    const body = enquiry();
    const results = await Promise.all(Array.from({ length: 5 }, () => createEnquiry(body, { fillMs: 5_000 })));
    expect(new Set(results.map((r) => String(r.enquiry._id))).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await EnquiryModel.countDocuments()).toBe(1);
  });
});

describe("managing enquiries", () => {
  it("updates status, adds notes and audits without copying the note text", async () => {
    const { enquiry: saved } = await createEnquiry(enquiry(), { fillMs: 5_000 });
    const updated = await updateEnquiry({ enquiryId: String(saved._id), status: "in_progress", note: "Called back, no answer", actor: "system" });
    expect(updated.status).toBe("in_progress");
    expect(updated.notes).toHaveLength(1);

    const audit = await AuditLogModel.findOne({ action: "enquiry.updated" }).lean();
    expect(audit?.changes).toEqual([
      { field: "status", from: "new", to: "in_progress" },
      { field: "notes", from: "[changed]", to: "[changed]" },
    ]);
    expect(JSON.stringify(audit)).not.toContain("Called back");
  });

  it("starts and cancels the spam deletion timer", async () => {
    const { enquiry: saved } = await createEnquiry(enquiry(), { fillMs: 5_000 });
    const spam = await updateEnquiry({ enquiryId: String(saved._id), status: "spam", actor: "system" });
    expect(spam.spamExpiresAt).toBeInstanceOf(Date);
    const restored = await updateEnquiry({ enquiryId: String(saved._id), status: "new", actor: "system" });
    expect(restored.spamExpiresAt).toBeUndefined();
  });

  it("rejects no-op updates and unknown ids", async () => {
    const { enquiry: saved } = await createEnquiry(enquiry(), { fillMs: 5_000 });
    await expect(updateEnquiry({ enquiryId: String(saved._id), status: "new", actor: "system" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(updateEnquiry({ enquiryId: "not-an-id", status: "resolved", actor: "system" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists with pagination, status filter and escaped search", async () => {
    for (let i = 0; i < 5; i++) await createEnquiry(enquiry({ name: i % 2 ? "Sita Devi" : "Ravi Kumar", phone: `+91987654320${i}` }), { fillMs: 5_000 });
    const page = await listEnquiries({ page: 1, pageSize: 2, status: ["new"] });
    expect(page.items).toHaveLength(2);
    expect(page.page).toMatchObject({ total: 5, totalPages: 3 });
    expect((await listEnquiries({ page: 1, pageSize: 10, q: "sita" })).page.total).toBe(2);
    expect((await listEnquiries({ page: 1, pageSize: 10, q: "6543202" })).page.total).toBe(1);
    expect((await listEnquiries({ page: 1, pageSize: 10, q: ".*" })).page.total).toBe(0);
  });
});

describe("enquiry notifications", () => {
  it("alerts staff when configured and records the attempt", async () => {
    const sent: string[][] = [];
    const provider: EmailProvider = {
      name: "fake",
      async send(message) {
        sent.push(message.to);
        return { id: "msg_1" };
      },
    };
    setEmailProviderForTests(provider);
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { "notifications.staffEmails": ["staff@example.com"] } });
    const { enquiry: saved } = await createEnquiry(enquiry(), { fillMs: 5_000 });
    await notifyEnquiryReceived(saved._id);
    expect(sent).toEqual([["staff@example.com"]]);
    expect(await NotificationAttemptModel.findOne({ subjectId: saved._id }).lean()).toMatchObject({ kind: "staff_new_enquiry", subjectType: "enquiry", status: "sent" });
  });

  it("does nothing when no staff email is configured", async () => {
    const { enquiry: saved } = await createEnquiry(enquiry(), { fillMs: 5_000 });
    await notifyEnquiryReceived(saved._id);
    expect(await NotificationAttemptModel.countDocuments()).toBe(0);
  });
});
