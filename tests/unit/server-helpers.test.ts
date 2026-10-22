// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { weeklyHoursSchema } from "@/features/clinic-settings/schemas";
import { assertSameOrigin, jsonError, MAX_BODY_BYTES, readJson } from "@/lib/api/http";
import { AppError, isDuplicateKeyError, toAppError } from "@/lib/errors";
import { maskEmail, maskPhone, redact } from "@/lib/logger";

const schema = z.object({ name: z.string().min(2) });

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("readJson", () => {
  it("parses a valid body", async () => {
    await expect(readJson(post('{"name":"Asha"}'), schema)).resolves.toEqual({ name: "Asha" });
  });

  it("rejects wrong content type, oversized and malformed bodies", async () => {
    await expect(readJson(post("{}", { "content-type": "text/plain" }), schema)).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
    await expect(readJson(post(`{"name":"${"a".repeat(MAX_BODY_BYTES)}"}`), schema)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    await expect(readJson(post("{not json"), schema)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns field errors for invalid input", async () => {
    const error = await readJson(post('{"name":"A"}'), schema).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "VALIDATION_FAILED", status: 422 });
    expect((error as AppError).fields).toHaveProperty("name");
  });
});

describe("assertSameOrigin", () => {
  it("accepts same-origin browser requests", () => {
    expect(() => assertSameOrigin(post("{}", { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }))).not.toThrow();
  });

  it("rejects cross-site and origin-less requests", () => {
    expect(() => assertSameOrigin(post("{}", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }))).toThrow(AppError);
    expect(() => assertSameOrigin(post("{}", { origin: "https://evil.example" }))).toThrow(AppError);
    expect(() => assertSameOrigin(post("{}"))).toThrow(AppError);
  });
});

describe("error responses", () => {
  it("uses the documented envelope and never leaks internals", async () => {
    const response = jsonError(new Error("connection string mongodb://user:secret@host"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "INTERNAL", message: expect.any(String), requestId: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("sets Retry-After for rate limits and maps database outages to 503", async () => {
    const limited = jsonError(new AppError("RATE_LIMITED", { details: { retryAfter: 42 } }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("42");

    const outage = Object.assign(new Error("timeout"), { name: "MongooseServerSelectionError" });
    expect(toAppError(outage).code).toBe("SERVICE_UNAVAILABLE");
  });

  it("recognises duplicate-key errors by index field", () => {
    const error = { code: 11000, keyPattern: { resourceKey: 1, start: 1 } };
    expect(isDuplicateKeyError(error, "resourceKey")).toBe(true);
    expect(isDuplicateKeyError(error, "reference")).toBe(false);
  });
});

describe("logger redaction", () => {
  it("redacts sensitive keys at any depth and masks contact details", () => {
    const out = redact({ patient: { name: "x", phoneE164: "+918006606001", email: "a@b.c" }, headers: { authorization: "Bearer t" }, ok: 1 });
    expect(JSON.stringify(out)).not.toMatch(/8006606001|a@b\.c|Bearer/);
    expect(maskPhone("+918006606001")).toBe("+91******6001");
    expect(maskEmail("ratan@example.com")).toBe("r***@example.com");
  });
});

describe("weekly hours validation", () => {
  const empty = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

  it("accepts ordered intervals with a break", () => {
    expect(weeklyHoursSchema.safeParse({ ...empty, sat: [{ open: "10:00", close: "13:00" }, { open: "17:00", close: "20:00" }] }).success).toBe(true);
  });

  it("rejects closing before opening, bad times and overlaps", () => {
    expect(weeklyHoursSchema.safeParse({ ...empty, mon: [{ open: "14:00", close: "10:00" }] }).success).toBe(false);
    expect(weeklyHoursSchema.safeParse({ ...empty, mon: [{ open: "9:00", close: "10:00" }] }).success).toBe(false);
    expect(weeklyHoursSchema.safeParse({ ...empty, mon: [{ open: "10:00", close: "13:00" }, { open: "12:00", close: "15:00" }] }).success).toBe(false);
  });
});
