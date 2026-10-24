import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

// Header and bundle checks are device-independent; run once.
test.skip(({ isMobile }) => isMobile, "security checks run in the desktop project only");

test("security headers are sent on pages and APIs", async ({ request }) => {
  for (const path of ["/", "/appointment", "/admin/login", "/api/public/settings"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["cross-origin-opener-policy"], path).toBe("same-origin");
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["x-powered-by"], path).toBeUndefined();

    const csp = headers["content-security-policy"];
    for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "frame-src 'none'", "connect-src 'self'"]) {
      expect(csp, `${path}: ${directive}`).toContain(directive);
    }
    // Production builds never allow eval.
    expect(csp).not.toContain("unsafe-eval");
  }
});

test("pages work under the Content-Security-Policy (no violations in the console)", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) violations.push(message.text().slice(0, 200));
  });
  for (const path of ["/", "/appointment", "/contact", "/services/dental-consultation", "/admin/login"]) {
    await page.goto(path, { waitUntil: "networkidle" });
  }
  expect(violations).toEqual([]);
});

test("private responses are never cached", async ({ request }) => {
  const status = await request.post("/api/public/appointments/status", { data: {}, headers: { origin: "http://example.invalid" } });
  expect(status.headers()["cache-control"]).toBe("no-store");
  const admin = await request.get("/api/admin/dashboard");
  expect(admin.status()).toBe(401);
  expect(admin.headers()["cache-control"]).toBe("no-store");
  const login = await request.get("/admin/login");
  expect(login.headers()["x-robots-tag"]).toContain("noindex");
});

test("the browser bundle contains no server secrets or server-only configuration", () => {
  const root = join(process.cwd(), ".next", "static");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".js")) files.push(full);
    }
  };
  walk(root);
  expect(files.length).toBeGreaterThan(5);
  const forbidden = [/MONGODB_URI/, /mongodb(\+srv)?:\/\//, /BETTER_AUTH_SECRET/, /RATE_LIMIT_SALT/, /RESEND_API_KEY/, /CRON_SECRET/, /development-only-auth-secret/, /mongoose/i, /better-auth\/adapters/];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) expect(pattern.test(content), `${pattern} found in ${file}`).toBe(false);
  }
});

test("oversized and malformed requests are rejected safely", async ({ request, baseURL }) => {
  const headers = { origin: new URL(baseURL!).origin, "sec-fetch-site": "same-origin", "x-forwarded-for": "203.0.113.250" };
  const notJson = await request.post("/api/public/enquiries", { headers: { ...headers, "content-type": "text/plain" }, data: "hello" });
  expect(notJson.status()).toBe(415);
  // Raw bytes: passing a string as `data` would be JSON-encoded into valid JSON.
  const malformed = await request.post("/api/public/enquiries", { headers: { ...headers, "content-type": "application/json" }, data: Buffer.from("{bad json") });
  expect(malformed.status()).toBe(400);
  const body = await malformed.json();
  expect(Object.keys(body.error).sort()).toEqual(["code", "message", "requestId"]);
  // NoSQL operator injection attempt is rejected by validation, never reaching the database.
  const injection = await request.post("/api/public/appointments/status", { headers, data: { reference: { $ne: "" }, phone: { $ne: "" } } });
  expect(injection.status()).toBe(422);
});
