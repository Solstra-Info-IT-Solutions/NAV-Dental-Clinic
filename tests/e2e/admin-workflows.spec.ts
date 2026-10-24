import { randomUUID } from "node:crypto";

import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";

import { E2E_CRON_SECRET, E2E_OWNER } from "./credentials";

/*
 * Admin workflows through the real HTTP API and UI (in-memory database).
 * Settings changes here only touch harmless fields so parallel tests are unaffected.
 */

let counter = 0;
const uniqueIp = () => `192.0.2.${100 + ((Date.now() + counter++) % 120)}`;

async function ownerApi(baseURL: string): Promise<APIRequestContext> {
  const context = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { origin: new URL(baseURL).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": uniqueIp() },
  });
  const response = await context.post("/api/auth/sign-in/email", { data: { email: E2E_OWNER.email, password: E2E_OWNER.password } });
  expect(response.status()).toBe(200);
  return context;
}

test.describe("admin API workflows", () => {
  test.skip(({ isMobile }) => isMobile, "API checks run in the desktop project only");

  test("settings: server-side validation and edit-conflict protection", async ({ baseURL }) => {
    const api = await ownerApi(baseURL!);
    const current = (await (await api.get("/api/admin/settings")).json()).data;

    const overlapping = await api.patch("/api/admin/settings", {
      data: { version: current.version, changes: { weeklyHours: { ...current.weeklyHours, mon: [{ open: "10:00", close: "14:00" }, { open: "13:00", close: "18:00" }] } } },
    });
    expect(overlapping.status()).toBe(422);
    expect(Object.keys((await overlapping.json()).error.fields).join(" ")).toContain("weeklyHours.mon");

    const badPhone = await api.patch("/api/admin/settings", { data: { version: current.version, changes: { phoneE164: "12345" } } });
    expect(badPhone.status()).toBe(422);

    const saved = await api.patch("/api/admin/settings", {
      data: { version: current.version, changes: { policies: { ...current.policies, cancellationText: `Please call to cancel (${randomUUID().slice(0, 6)})` } } },
    });
    expect(saved.status()).toBe(200);
    expect((await saved.json()).data.version).toBe(current.version + 1);

    // A second save based on the old version must not overwrite the newer one.
    const stale = await api.patch("/api/admin/settings", { data: { version: current.version, changes: { policies: current.policies } } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe("VERSION_CONFLICT");
  });

  test("enquiries: a website message can be triaged by staff", async ({ request, baseURL }) => {
    const ip = uniqueIp();
    const sent = await request.post("/api/public/enquiries", {
      headers: { origin: new URL(baseURL!).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": ip },
      data: {
        idempotencyKey: randomUUID(),
        name: "Workflow Enquirer",
        phone: `98${String(Date.now()).slice(-8)}`,
        category: "treatment-info",
        message: "Do you offer teeth cleaning?",
        privacyAcknowledged: true,
        hp: "",
        formStartedAt: Date.now() - 30_000,
      },
    });
    expect(sent.status()).toBe(201);

    const api = await ownerApi(baseURL!);
    const list = (await (await api.get("/api/admin/enquiries?q=Workflow%20Enquirer")).json()).data;
    expect(list[0]).toMatchObject({ name: "Workflow Enquirer", status: "new" });
    expect(list[0].phoneMasked).toMatch(/\*{4}/);

    const updated = await api.patch(`/api/admin/enquiries/${list[0].id}`, { data: { status: "in_progress", note: "Called back" } });
    expect(updated.status()).toBe(200);
    const detail = (await (await api.get(`/api/admin/enquiries/${list[0].id}`)).json()).data;
    expect(detail.status).toBe("in_progress");
    expect(detail.notes.map((n: { text: string }) => n.text)).toEqual(["Called back"]);
  });

  test("unknown records return the standard 404 envelope", async ({ baseURL }) => {
    const api = await ownerApi(baseURL!);
    for (const path of ["/api/admin/appointments/0123456789abcdef01234567", "/api/admin/appointments/not-an-id", "/api/admin/enquiries/0123456789abcdef01234567"]) {
      const response = await api.get(path);
      expect(response.status(), path).toBe(404);
      expect((await response.json()).error).toMatchObject({ code: "NOT_FOUND", requestId: expect.any(String) });
    }
  });

  test("the notification retry job runs only with the cron secret", async ({ request }) => {
    expect((await request.get("/api/cron/notifications", { headers: { authorization: "Bearer wrong-secret-value-123456" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/notifications", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).data).toMatchObject({ processed: expect.any(Number), sent: expect.any(Number) });
  });
});

test.describe("admin on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layout only");

  test("admin screens fit a phone screen and the menu works", async ({ page, request, baseURL }) => {
    test.setTimeout(90_000);
    // Make sure the dashboard and lists contain at least one wide table row (the overflow bug only showed with data).
    const ip = uniqueIp();
    const dates = (await (await request.get("/api/public/available-dates?service=dental-consultation&days=31", { headers: { "x-forwarded-for": ip } })).json()).data.dates;
    const day = dates.filter((d: { available: boolean }) => d.available).at(-2);
    const slots = (await (await request.get(`/api/public/slots?service=dental-consultation&date=${day.date}`, { headers: { "x-forwarded-for": ip } })).json()).data.slots;
    const booked = await request.post("/api/public/appointments", {
      headers: { origin: new URL(baseURL!).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": ip },
      data: {
        idempotencyKey: randomUUID(),
        patient: { name: "Phone Layout Patient", phone: `95${String(Date.now()).slice(-8)}`, email: "" },
        service: "dental-consultation",
        start: slots.at(-1).start,
        privacyAcknowledged: true,
        marketingOptIn: false,
        policyVersion: "2026-10-22-draft",
        hp: "",
        formStartedAt: Date.now() - 30_000,
      },
    });
    expect([201, 409]).toContain(booked.status());
    await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(E2E_OWNER.email);
    await page.getByLabel("Password").fill(E2E_OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({ timeout: 20_000 });

    for (const path of ["/admin", "/admin/appointments", "/admin/schedule", "/admin/enquiries", "/admin/settings", "/admin/users"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }

    await page.getByText("Menu", { exact: true }).click();
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Enquiries" }).click();
    await expect(page).toHaveURL(/\/admin\/enquiries$/);
  });
});
