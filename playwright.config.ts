import { defineConfig, devices } from "@playwright/test";

import { E2E_CRON_SECRET, E2E_OWNER } from "./tests/e2e/credentials";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * End-to-end tests run against a production build (`npm run build` first).
 * Set E2E_BASE_URL to test an already-running deployment instead.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Test-only owner for the throwaway in-memory database (see scripts/with-db.ts).
        env: { DEV_ADMIN_EMAIL: E2E_OWNER.email, DEV_ADMIN_PASSWORD: E2E_OWNER.password, CRON_SECRET: E2E_CRON_SECRET },
      },
});
