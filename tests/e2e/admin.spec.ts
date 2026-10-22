import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_OWNER } from "./credentials";

/*
 * Admin security and workflow tests. They run against the in-memory database
 * where scripts/with-db.ts creates the test-only owner account.
 */

let counter = 0;
const uniqueIp = () => `192.0.2.${(Date.now() % 200) + (counter++ % 50)}`;

type Route = { method: string; path: string; role: "owner" | "staff" };

/** Discovers every admin endpoint from the route files, so new routes are covered automatically. */
function discoverAdminRoutes(): Route[] {
  const root = join(process.cwd(), "src", "app", "api", "admin");
  const routes: Route[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.ts") {
        const source = readFileSync(full, "utf8");
        const path =
          "/api/admin/" +
          relative(root, dir)
            .split(sep)
            .map((segment) => (segment.startsWith("[") ? "0123456789abcdef01234567" : segment))
            .join("/");
        for (const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = adminRoute(?:<[^>]*>)?\("(owner|staff)"/g)) {
          routes.push({ method: match[1], path: path.replace(/\/$/, ""), role: match[2] as Route["role"] });
        }
      }
    }
  };
  walk(root);
  return routes;
}

const ROUTES = discoverAdminRoutes();

async function signedInContext(baseURL: string, email: string, password: string): Promise<APIRequestContext> {
  const context = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { origin: new URL(baseURL).origin, "x-forwarded-for": uniqueIp() } });
  const response = await context.post("/api/auth/sign-in/email", { data: { email, password } });
  expect(response.status(), `sign-in for ${email}`).toBe(200);
  return context;
}

async function call(context: APIRequestContext, route: Route) {
  const options = { headers: { "sec-fetch-site": "same-origin" }, data: route.method === "GET" ? undefined : {} };
  return context.fetch(`${route.path}${route.method === "GET" ? "?date=2026-01-01&from=2026-01-01&to=2026-01-02" : ""}`, { method: route.method, ...options });
}

test.describe("admin API authorisation", () => {
  test.skip(({ isMobile }) => isMobile, "API checks run in the desktop project only");

  test("route discovery found the admin API", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(30);
  });

  test("every admin endpoint refuses anonymous requests with 401", async ({ baseURL }) => {
    const anonymous = await playwrightRequest.newContext({ baseURL, extraHTTPHeaders: { origin: new URL(baseURL!).origin } });
    for (const route of ROUTES) {
      const response = await call(anonymous, route);
      expect(response.status(), `${route.method} ${route.path}`).toBe(401);
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("staff accounts get 403 on owner-only endpoints but can use staff endpoints", async ({ baseURL }) => {
    const owner = await signedInContext(baseURL!, E2E_OWNER.email, E2E_OWNER.password);
    const email = `staff-${randomUUID().slice(0, 8)}@nav-dental.test`;
    const created = await owner.post("/api/admin/users", { headers: { "sec-fetch-site": "same-origin" }, data: { name: "Front Desk", email, role: "staff" } });
    expect(created.status()).toBe(201);
    const { temporaryPassword } = (await created.json()).data;
    const staff = await signedInContext(baseURL!, email, temporaryPassword);

    for (const route of ROUTES) {
      const status = (await call(staff, route)).status();
      if (route.role === "owner") expect(status, `${route.method} ${route.path}`).toBe(403);
      else expect([401, 403], `${route.method} ${route.path} returned ${status}`).not.toContain(status);
    }
  });

  test("admin mutations from another site are refused", async ({ baseURL }) => {
    const owner = await signedInContext(baseURL!, E2E_OWNER.email, E2E_OWNER.password);
    const response = await owner.patch("/api/admin/settings", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" }, data: { version: 1, changes: {} } });
    expect(response.status()).toBe(403);
  });

  test("public sign-up is disabled", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: "intruder@example.com", password: "a-long-password-123", name: "Intruder" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("admin pages", () => {
  test("signed-out visitors are sent to the sign-in page, which is not indexed", async ({ page }) => {
    await page.goto("/admin/appointments");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(E2E_OWNER.email);
    await page.getByLabel("Password").fill("not-the-right-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "The email or password is incorrect." })).toBeVisible();
  });

  test("owner confirms an online request; the patient's status page shows it confirmed", async ({ page, request, baseURL }) => {
    test.skip(test.info().project.name === "mobile", "one full run is enough");
    // A patient books online.
    const ip = uniqueIp();
    const dates = await (await request.get("/api/public/available-dates?service=dental-consultation&days=31", { headers: { "x-forwarded-for": ip } })).json();
    const day = dates.data.dates.filter((d: { available: boolean }) => d.available).at(-1);
    const slots = await (await request.get(`/api/public/slots?service=dental-consultation&date=${day.date}`, { headers: { "x-forwarded-for": ip } })).json();
    const phone = `+9196${String(Date.now()).slice(-8)}`;
    const booked = await request.post("/api/public/appointments", {
      headers: { origin: new URL(baseURL!).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": ip },
      data: {
        idempotencyKey: randomUUID(),
        patient: { name: "Admin Flow Patient", phone, email: "" },
        service: "dental-consultation",
        start: slots.data.slots[0].start,
        privacyAcknowledged: true,
        marketingOptIn: false,
        policyVersion: "2026-10-22-draft",
        hp: "",
        formStartedAt: Date.now() - 30_000,
      },
    });
    expect(booked.status()).toBe(201);
    const { reference } = (await booked.json()).data;

    // Staff signs in and confirms it.
    await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(E2E_OWNER.email);
    await page.getByLabel("Password").fill(E2E_OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({ timeout: 20_000 });

    await page.goto(`/admin/appointments?q=${reference}`);
    await page.getByRole("link", { name: "Admin Flow Patient" }).click();
    await expect(page.getByRole("heading", { name: "Admin Flow Patient", level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Note (optional, internal)").fill("Called patient, time agreed");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Called patient, time agreed")).toBeVisible();

    // The patient's public status lookup reflects the change.
    const status = await request.post("/api/public/appointments/status", {
      headers: { origin: new URL(baseURL!).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": uniqueIp() },
      data: { reference, phone },
    });
    expect((await status.json()).data.status).toBe("confirmed");

    // Audit trail records the change; signing out ends access.
    await page.goto("/admin/audit");
    await expect(page.getByText("appointment.status_changed").first()).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("admin screens have no serious accessibility violations", async ({ page }) => {
  // Ten full-page axe scans take longer than the default 30 s budget.
  test.setTimeout(120_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  await page.goto("/admin/login");
  expect(await seriousViolations(page)).toEqual([]);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(E2E_OWNER.email);
  await page.getByLabel("Password").fill(E2E_OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The first sign-in on a freshly started server initialises auth and hashes the password.
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible({ timeout: 20_000 });
  for (const path of ["/admin", "/admin/appointments", "/admin/appointments/new", "/admin/schedule", "/admin/enquiries", "/admin/settings", "/admin/services", "/admin/users", "/admin/audit", "/admin/notifications"]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

