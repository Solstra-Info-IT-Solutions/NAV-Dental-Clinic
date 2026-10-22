import { describe, expect, it } from "vitest";

import { enquiryFormSchema, enquiryRequestSchema } from "@/features/enquiries/schemas";
import { staffNewEnquiryEmail } from "@/features/notifications/templates";

// contentSpamScore lives in a server-only module; the alias in vitest.config makes it importable here.
import { contentSpamScore } from "@/features/enquiries/service";

const valid = {
  idempotencyKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
  name: "Ravi Kumar",
  phone: "9876543210",
  email: "",
  category: "general",
  message: "Do you see patients on Sundays?",
  privacyAcknowledged: true,
  formStartedAt: 1,
};

describe("enquiry schemas", () => {
  it("normalises and accepts a valid enquiry", () => {
    expect(enquiryRequestSchema.parse(valid)).toMatchObject({ phone: "+919876543210", email: undefined, category: "general", hp: "" });
  });

  it("enforces message length, category and consent", () => {
    expect(enquiryRequestSchema.safeParse({ ...valid, message: "short" }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...valid, category: "sales" }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse({ ...valid, privacyAcknowledged: false }).success).toBe(false);
  });

  it("strips control characters before checking length", () => {
    const parsed = enquiryRequestSchema.parse({ ...valid, message: "\u0000\u0007Hello there, is parking available?\u001b" });
    expect(parsed.message).toBe("Hello there, is parking available?");
  });

  it("gives friendly messages for an empty form", () => {
    const result = enquiryFormSchema.safeParse({ name: "", phone: "", email: "", category: "", message: "", privacyAcknowledged: false, hp: "" });
    expect(result.error!.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(["Enter your full name.", "Enter your mobile number.", "Choose what your enquiry is about.", "Please confirm you have read the privacy notice."]),
    );
  });
});

describe("content spam score", () => {
  it("flags link-stuffed and known-spam messages, not normal questions", () => {
    expect(contentSpamScore("What are your timings on Saturday?")).toBe(0);
    expect(contentSpamScore("See my reports at https://drive.example.com/x")).toBe(1);
    expect(contentSpamScore("Buy http://a.example http://b.example www.c.example now")).toBeGreaterThanOrEqual(3);
    expect(contentSpamScore("Best SEO services and backlinks for your clinic")).toBeGreaterThanOrEqual(3);
  });
});

describe("staff enquiry email", () => {
  it("escapes the patient's message", () => {
    const email = staffNewEnquiryEmail(
      { name: "Ravi", phoneE164: "+919876543210", categoryLabel: "General question", message: "<script>alert(1)</script>", createdAt: new Date("2026-11-03T04:30:00Z") },
      { clinicName: "NAV Dental Clinic", phoneE164: "+918006606001", addressLine: "Somna Road, Pahasu" },
      "https://example.com/admin/enquiries",
    );
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain("Mobile: +91 98765 43210");
  });
});
