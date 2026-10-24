import { expect, test, type Page } from "@playwright/test";

// SEO checks are device-independent; run once.
test.skip(({ isMobile }) => isMobile, "SEO checks run in the desktop project only");

const PAGES = ["/", "/about", "/services", "/services/dental-consultation", "/appointment", "/contact", "/faq", "/privacy-policy", "/terms"];

async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((b) => {
    const parsed = JSON.parse(b);
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

test("local builds are kept out of search engines", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \/\s*$/m);
  const home = await request.get("/");
  expect(home.headers()["x-robots-tag"]).toContain("noindex");
});

test("sitemap lists public pages and published services only", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(urls).toEqual(expect.arrayContaining(["/", "/appointment", "/services", "/about", "/contact", "/faq", "/services/dental-consultation"]));
  for (const hidden of ["/admin", "/api", "/appointment/status", "/privacy-policy", "/terms", "/services/teeth-whitening"]) {
    expect(urls).not.toContain(hidden);
  }
});

test("every public page has a unique title, description and correct canonical", async ({ page }) => {
  const titles = new Set<string>();
  for (const path of PAGES) {
    await page.goto(path);
    const title = await page.title();
    expect(titles.has(title), `duplicate title ${title}`).toBe(false);
    titles.add(title);
    expect((await page.locator('meta[name="description"]').getAttribute("content"))?.length).toBeGreaterThan(50);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname.replace(/\/$/, "") || "/").toBe(path);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  }
});

test("the Open Graph image is served", async ({ page, request }) => {
  await page.goto("/");
  const image = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(image).toBeTruthy();
  const response = await request.get(new URL(image!).pathname + new URL(image!).search);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /NAV Dental Clinic/);
});

test("home page describes the clinic with verified structured data only", async ({ page }) => {
  await page.goto("/");
  const data = await jsonLd(page);
  const clinic = data.find((d) => d["@type"] === "Dentist")!;
  expect(clinic).toMatchObject({ name: "NAV Dental Clinic", telephone: "+918006606001", address: { addressLocality: "Pahasu", addressCountry: "IN" } });
  expect(data.find((d) => d["@type"] === "WebSite")).toMatchObject({ publisher: { "@id": clinic["@id"] } });
  const raw = JSON.stringify(data);
  for (const forbidden of ["aggregateRating", "review", "priceRange", "award", "geo"]) expect(raw).not.toContain(`"${forbidden}"`);
});

test("service and FAQ pages carry breadcrumb, service and FAQ data matching the page", async ({ page }) => {
  await page.goto("/services/dental-consultation");
  const serviceData = await jsonLd(page);
  expect(serviceData.find((d) => d["@type"] === "Service")).toMatchObject({ name: "Dental Consultation" });
  const crumbs = serviceData.find((d) => d["@type"] === "BreadcrumbList") as { itemListElement: { name: string }[] };
  expect(crumbs.itemListElement.map((i) => i.name)).toEqual(["Home", "Services", "Dental Consultation"]);

  await page.goto("/faq");
  const faq = (await jsonLd(page)).find((d) => d["@type"] === "FAQPage") as { mainEntity: { name: string }[] };
  const visibleQuestions = await page.locator("main details summary").allTextContents();
  expect(faq.mainEntity.map((q) => q.name)).toEqual(visibleQuestions.map((q) => q.trim()));
});

test("headings follow a single-h1 outline and images have alt text", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    const missingAlt = await page.locator("main img:not([alt])").count();
    expect(missingAlt, path).toBe(0);
  }
});
