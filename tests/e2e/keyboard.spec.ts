import { expect, test, type Page } from "@playwright/test";

/*
 * Keyboard and motion accessibility (WCAG 2.1.1 Keyboard, 2.4.7 Focus Visible,
 * 2.3.3 Animation from Interactions). Desktop only: these exercise physical keys.
 */
test.skip(({ isMobile }) => isMobile, "keyboard checks run in the desktop project only");

async function focusIndicator(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const own = getComputedStyle(el);
    // Custom radio "chips" show focus on their wrapping <label> (has-focus-visible).
    const label = el.closest("label");
    const wrapper = label ? getComputedStyle(label) : null;
    const visible = (s: CSSStyleDeclaration | null) => Boolean(s && ((s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"));
    return {
      tag: el.tagName,
      text: (el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).name || "").trim().slice(0, 40),
      visible: visible(own) || visible(wrapper),
    };
  });
}

for (const path of ["/", "/appointment", "/contact"]) {
  test(`every focusable element on ${path} shows a visible focus indicator`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const seen: string[] = [];
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press("Tab");
      const focus = await focusIndicator(page);
      if (!focus) continue;
      expect(focus.visible, `no visible focus on <${focus.tag}> "${focus.text}" (${path})`).toBe(true);
      seen.push(focus.text);
    }
    expect(seen.length).toBeGreaterThan(10);
  });
}

test("the booking form can be completed with the keyboard alone", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${200 + (Date.now() % 50)}` });
  await page.goto("/appointment", { waitUntil: "networkidle" });

  // Service is preselected (single bookable service). Move to the first date chip.
  await page.getByLabel("What is the visit for?").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space"); // select the first available date
  await expect(page.getByRole("group", { name: /3\. Choose a time on/ })).toBeVisible();

  // Tab into the time radios and choose one with the keyboard.
  const firstTime = page.getByRole("group", { name: /3\. Choose a time/ }).getByRole("radio").first();
  await expect(firstTime).toBeAttached();
  await firstTime.focus();
  await page.keyboard.press("Space");
  await expect(firstTime).toBeChecked();

  await page.getByLabel("Full name").focus();
  await page.keyboard.type("Keyboard User");
  await page.keyboard.press("Tab");
  await page.keyboard.type(`97${String(Date.now()).slice(-8)}`);
  await page.getByLabel(/I have read the/).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(3_200); // minimum human fill time (spam protection)
  await page.getByRole("button", { name: "Send appointment request" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Request received" })).toBeFocused();
});

test("animations are switched off for people who prefer reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.evaluate(() => getComputedStyle(document.querySelector("header a, main a, button")!).transitionDuration);
  expect(duration.split(",").every((d) => parseFloat(d) <= 0.0001)).toBe(true);
});
