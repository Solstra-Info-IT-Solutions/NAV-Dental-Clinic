import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", h1: "Careful dental care, close to home" },
  { path: "/about", h1: "About NAV Dental Clinic" },
  { path: "/services", h1: "Dental services" },
  { path: "/services/dental-consultation", h1: "Dental Consultation" },
  { path: "/appointment", h1: "Book an appointment" },
  { path: "/contact", h1: "Contact the clinic" },
  { path: "/faq", h1: "Frequently asked questions" },
  { path: "/privacy-policy", h1: "Privacy Policy" },
  { path: "/terms", h1: "Terms of Use" },
];

for (const route of routes) {
  test.describe(`page ${route.path}`, () => {
    test("loads with one h1, a unique title and the clinic phone link", async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(route.h1);
      await expect(page).toHaveTitle(/NAV Dental Clinic/);
      await expect(page.locator('a[href="tel:+918006606001"]').first()).toBeAttached();
    });

    test("has no serious or critical accessibility violations", async ({ page }) => {
      await page.goto(route.path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });

    test("does not scroll horizontally", async ({ page }) => {
      await page.goto(route.path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test("no horizontal scroll at common breakpoints", async ({ page, isMobile }) => {
  test.skip(isMobile, "viewport sizes are set explicitly");
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/services/dental-consultation", "/contact"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test("header actions fit inside the viewport at 1024px", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop header only");
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");
  const box = await page.getByRole("banner").getByRole("link", { name: "Request an appointment" }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
});

test("unknown pages return 404 with recovery links", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
});

test("unpublished services are not reachable", async ({ page }) => {
  const response = await page.goto("/services/teeth-whitening");
  expect(response?.status()).toBe(404);
});

test("draft legal pages are excluded from search indexing", async ({ page }) => {
  await page.goto("/privacy-policy");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("skip link moves focus to the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test.describe("mobile navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("menu opens, navigates and closes; quick action bar is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Quick actions" })).toBeVisible();
    // The toggle's accessible name flips between "Open menu" and "Close menu", so locate it by its role in the header.
    const toggle = page.getByRole("banner").locator("button[aria-expanded]");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Services" }).click();
    await expect(page).toHaveURL(/\/services$/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape closes the menu and restores focus", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });
});

test.describe("desktop navigation", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("primary links reach each section and mark the current page", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Main" });
    for (const [label, url] of [["About", /\/about$/], ["Services", /\/services$/], ["FAQ", /\/faq$/], ["Contact", /\/contact$/]] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    }
  });
});
