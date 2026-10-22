import { expect, test } from "@playwright/test";

// API responses are identical on every device; run them once.
test.skip(({ isMobile }) => isMobile, "API checks run in the desktop project only");

test("GET /api/public/settings returns the public subset from the database", async ({ request }) => {
  const response = await request.get("/api/public/settings");
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const { data } = await response.json();
  expect(data).toMatchObject({
    clinicName: "NAV Dental Clinic",
    doctorName: "Dr. Ratan Raghav",
    phoneE164: "+918006606001",
    bookingMode: "request",
  });
  const json = JSON.stringify(data);
  for (const hidden of ["staffEmails", "notifications", "version", "_id", "policies"]) expect(json).not.toContain(hidden);
});

test("GET /api/public/services lists published services only", async ({ request }) => {
  const response = await request.get("/api/public/services");
  expect(response.status()).toBe(200);
  const { data } = await response.json();
  expect(data.map((s: { slug: string }) => s.slug)).toEqual(["dental-consultation"]);
});

test("GET /api/public/services/{slug} returns 404 envelope for unpublished services", async ({ request }) => {
  const ok = await request.get("/api/public/services/dental-consultation");
  expect(ok.status()).toBe(200);

  const missing = await request.get("/api/public/services/teeth-whitening");
  expect(missing.status()).toBe(404);
  const body = await missing.json();
  expect(body.error).toMatchObject({ code: "NOT_FOUND", requestId: expect.any(String) });
  expect(missing.headers()["cache-control"]).toBe("no-store");
});

test("public read endpoints reject writes", async ({ request }) => {
  const response = await request.post("/api/public/settings", { data: { clinicName: "x" } });
  expect(response.status()).toBe(405);
});
