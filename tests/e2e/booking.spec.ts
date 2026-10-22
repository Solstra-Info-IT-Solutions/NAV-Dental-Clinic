import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";

/*
 * Runs against `npm run start` with the in-memory development database, which
 * is seeded with SAMPLE opening hours (never the clinic's real hours).
 * Each test uses its own X-Forwarded-For value and phone number so the
 * production rate limits apply per test instead of across the whole suite.
 */

let counter = 0;
const uniqueIp = () => `198.51.100.${(Date.now() % 200) + (counter++ % 50)}`;
const uniquePhone = () => `+9198${String(Date.now()).slice(-6)}${String(counter++ % 100).padStart(2, "0")}`;

function sameOriginHeaders(baseURL: string, ip: string) {
  return { origin: new URL(baseURL).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": ip };
}

async function firstOpenDaySlots(request: APIRequestContext, ip: string) {
  const dates = await request.get("/api/public/available-dates?service=dental-consultation&days=31", { headers: { "x-forwarded-for": ip } });
  expect(dates.status()).toBe(200);
  const day = (await dates.json()).data.dates.find((d: { available: boolean }) => d.available);
  const slots = await request.get(`/api/public/slots?service=dental-consultation&date=${day.date}`, { headers: { "x-forwarded-for": ip } });
  return (await slots.json()).data.slots as { start: string; label: string }[];
}

function bookingBody(start: string, phone: string, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    patient: { name: "Test Patient", phone, email: "" },
    service: "dental-consultation",
    start,
    privacyAcknowledged: true,
    marketingOptIn: false,
    policyVersion: "2026-10-22-draft",
    hp: "",
    formStartedAt: Date.now() - 30_000,
    ...overrides,
  };
}

test.describe("booking in the browser", () => {
  test("patient requests an appointment and checks its status", async ({ page }) => {
    const phone = uniquePhone();
    await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
    await page.goto("/appointment");
    await expect(page.getByRole("note")).toContainText("sample data");

    // Date and time choices come from the server.
    const dateGroup = page.getByRole("group", { name: "2. Choose a date" });
    await dateGroup.locator("label").first().click();
    const timeGroup = page.getByRole("group", { name: /3\. Choose a time/ });
    await expect(timeGroup.locator("label").first()).toBeVisible();
    await timeGroup.locator("label").first().click();

    await page.getByLabel("Full name").fill("Asha Verma");
    await page.getByLabel("Mobile number").fill(phone.replace("+91", ""));
    await page.getByLabel(/I have read the/).check();
    // The server rejects forms completed in under 3 seconds as automated (spam protection).
    await page.waitForTimeout(3_200);
    await page.getByRole("button", { name: "Send appointment request" }).click();

    await expect(page.getByRole("heading", { name: "Request received" })).toBeFocused();
    await expect(page.getByText("This is not yet a confirmed appointment")).toBeVisible();
    const reference = (await page.getByTestId("booking-reference").textContent())!.trim();
    expect(reference).toMatch(/^NAV-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/);

    await page.getByRole("link", { name: "Check request status" }).click();
    await page.getByLabel("Booking reference").fill(reference.toLowerCase());
    await page.getByLabel("Mobile number used for the booking").fill(phone);
    await page.getByRole("button", { name: "Check status" }).click();
    await expect(page.getByTestId("booking-status")).toHaveText("Request received – waiting for the clinic to confirm");
  });

  test("shows an error summary and keeps focus management for an incomplete form", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
    await page.goto("/appointment");
    await page.getByRole("button", { name: "Send appointment request" }).click();
    // Scope to the form: Next.js's route announcer is also an ARIA alert.
    const summary = page.locator("form").getByRole("alert");
    await expect(summary).toContainText("Choose a date.");
    await expect(summary).toContainText("Enter your full name.");
    await expect(summary).toContainText("Please confirm you have read the privacy notice.");
    await expect(page.getByLabel("Mobile number")).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("booking API", () => {
  test.skip(({ isMobile }) => isMobile, "API checks run in the desktop project only");

  test("two simultaneous requests for one slot: one 201, one 409 with alternatives", async ({ request, baseURL }) => {
    const ip = uniqueIp();
    const slots = await firstOpenDaySlots(request, ip);
    const start = slots.at(-1)!.start;
    const [a, b] = await Promise.all([
      request.post("/api/public/appointments", { headers: sameOriginHeaders(baseURL!, uniqueIp()), data: bookingBody(start, uniquePhone()) }),
      request.post("/api/public/appointments", { headers: sameOriginHeaders(baseURL!, uniqueIp()), data: bookingBody(start, uniquePhone()) }),
    ]);
    expect([a.status(), b.status()].sort()).toEqual([201, 409]);
    const loser = a.status() === 409 ? a : b;
    const body = await loser.json();
    expect(body.error.code).toBe("SLOT_UNAVAILABLE");
    expect(Array.isArray(body.error.alternatives)).toBe(true);
  });

  test("a retried submission with the same idempotency key returns the same reference", async ({ request, baseURL }) => {
    const ip = uniqueIp();
    const slots = await firstOpenDaySlots(request, ip);
    const body = bookingBody(slots.at(-2)!.start, uniquePhone());
    const first = await request.post("/api/public/appointments", { headers: sameOriginHeaders(baseURL!, ip), data: body });
    const second = await request.post("/api/public/appointments", { headers: sameOriginHeaders(baseURL!, ip), data: body });
    expect(first.status()).toBe(201);
    expect(second.status()).toBe(200);
    expect((await second.json()).data).toMatchObject({ reference: (await first.json()).data.reference, replayed: true });
  });

  test("rejects past times, cross-site posts and bot submissions", async ({ request, baseURL }) => {
    const ip = uniqueIp();
    const past = await request.post("/api/public/appointments", {
      headers: sameOriginHeaders(baseURL!, ip),
      data: bookingBody("2020-01-07T04:30:00.000Z", uniquePhone()),
    });
    expect(past.status()).toBe(422);

    const crossSite = await request.post("/api/public/appointments", {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", "x-forwarded-for": uniqueIp() },
      data: bookingBody("2020-01-07T04:30:00.000Z", uniquePhone()),
    });
    expect(crossSite.status()).toBe(403);

    const bot = await request.post("/api/public/appointments", {
      headers: sameOriginHeaders(baseURL!, uniqueIp()),
      data: bookingBody("2020-01-07T04:30:00.000Z", uniquePhone(), { hp: "https://spam.example" }),
    });
    expect(bot.status()).toBe(422);

    const oversized = await request.post("/api/public/appointments", {
      headers: sameOriginHeaders(baseURL!, uniqueIp()),
      data: bookingBody("2020-01-07T04:30:00.000Z", uniquePhone(), { message: "x".repeat(20_000) }),
    });
    expect(oversized.status()).toBe(413);
  });

  test("status lookup hides bookings behind reference + phone and is rate limited", async ({ request, baseURL }) => {
    const ip = uniqueIp();
    const slots = await firstOpenDaySlots(request, ip);
    const phone = uniquePhone();
    const created = await request.post("/api/public/appointments", { headers: sameOriginHeaders(baseURL!, ip), data: bookingBody(slots.at(-3)!.start, phone) });
    const { reference } = (await created.json()).data;

    const lookupIp = uniqueIp();
    const ok = await request.post("/api/public/appointments/status", { headers: sameOriginHeaders(baseURL!, lookupIp), data: { reference, phone } });
    expect(ok.status()).toBe(200);
    expect(Object.keys((await ok.json()).data).sort()).toEqual(["reference", "serviceTitle", "start", "status"]);

    const wrong = await request.post("/api/public/appointments/status", { headers: sameOriginHeaders(baseURL!, lookupIp), data: { reference, phone: "+919000000000" } });
    expect(wrong.status()).toBe(404);

    let last = 0;
    for (let i = 0; i < 10; i++) {
      last = (await request.post("/api/public/appointments/status", { headers: sameOriginHeaders(baseURL!, lookupIp), data: { reference, phone } })).status();
    }
    expect(last).toBe(429);
  });

  test("cron endpoint requires the secret", async ({ request }) => {
    expect((await request.get("/api/cron/notifications")).status()).toBe(401);
  });
});
