import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

let counter = 0;
const uniqueIp = () => `203.0.113.${(Date.now() % 200) + (counter++ % 50)}`;
const uniquePhone = () => `+9197${String(Date.now()).slice(-6)}${String(counter++ % 100).padStart(2, "0")}`;

function headers(baseURL: string, ip: string) {
  return { origin: new URL(baseURL).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": ip };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    name: "Ravi Kumar",
    phone: uniquePhone(),
    email: "",
    category: "general",
    message: "Is there parking near the clinic?",
    privacyAcknowledged: true,
    hp: "",
    formStartedAt: Date.now() - 30_000,
    ...overrides,
  };
}

test("visitor sends an enquiry through the contact form", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  await page.goto("/contact");
  const form = page.locator("form");
  await form.getByLabel("Full name").fill("Ravi Kumar");
  await form.getByLabel("Mobile number").fill(uniquePhone().replace("+91", ""));
  await form.getByLabel("What is your enquiry about?").selectOption("treatment-info");
  await form.getByLabel("Your message").fill("Do you offer root canal treatment at the clinic?");
  await form.getByLabel(/I have read the/).check();
  // Forms completed in under 3 seconds are treated as automated.
  await page.waitForTimeout(3_200);
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: "Message sent" })).toBeFocused();
});

test("contact form shows accessible errors when incomplete", async ({ page }) => {
  await page.goto("/contact");
  const form = page.locator("form");
  await form.getByRole("button", { name: "Send message" }).click();
  const summary = form.getByRole("alert");
  await expect(summary).toContainText("Enter your full name.");
  await expect(summary).toContainText("Choose what your enquiry is about.");
  await expect(form.getByLabel("Your message")).toHaveAttribute("aria-invalid", "true");
});

test.describe("enquiries API", () => {
  test.skip(({ isMobile }) => isMobile, "API checks run in the desktop project only");

  test("accepts, replays and validates enquiries", async ({ request, baseURL }) => {
    const ip = uniqueIp();
    const data = body();
    const created = await request.post("/api/public/enquiries", { headers: headers(baseURL!, ip), data });
    expect(created.status()).toBe(201);
    expect((await created.json()).data).toEqual({ received: true });

    const replay = await request.post("/api/public/enquiries", { headers: headers(baseURL!, ip), data });
    expect(replay.status()).toBe(200);

    const invalid = await request.post("/api/public/enquiries", { headers: headers(baseURL!, uniqueIp()), data: body({ message: "hi", phone: "123" }) });
    expect(invalid.status()).toBe(422);
    expect(Object.keys((await invalid.json()).error.fields)).toEqual(expect.arrayContaining(["message", "phone"]));
  });

  test("refuses bots, cross-site posts and floods", async ({ request, baseURL }) => {
    expect((await request.post("/api/public/enquiries", { headers: headers(baseURL!, uniqueIp()), data: body({ hp: "spam" }) })).status()).toBe(422);
    expect((await request.post("/api/public/enquiries", { headers: headers(baseURL!, uniqueIp()), data: body({ formStartedAt: Date.now() }) })).status()).toBe(422);
    expect(
      (await request.post("/api/public/enquiries", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" }, data: body() })).status(),
    ).toBe(403);

    const ip = uniqueIp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await request.post("/api/public/enquiries", { headers: headers(baseURL!, ip), data: body() })).status());
    expect(statuses).toEqual([201, 201, 201, 429]);
  });

  test("spam-looking content gets the same response as a normal enquiry", async ({ request, baseURL }) => {
    const response = await request.post("/api/public/enquiries", {
      headers: headers(baseURL!, uniqueIp()),
      data: body({ message: "SEO services and backlinks http://a.example http://b.example http://c.example" }),
    });
    expect(response.status()).toBe(201);
    expect((await response.json()).data).toEqual({ received: true });
  });
});
