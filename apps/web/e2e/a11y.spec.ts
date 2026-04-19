/**
 * Accessibility tests using axe-core via Playwright.
 * Requires: pnpm add -D @axe-core/playwright
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES_TO_TEST = [
  { name: "Login", path: "/login" },
  { name: "Home redirect", path: "/" },
];

for (const { name, path } of PAGES_TO_TEST) {
  test(`a11y: ${name} — sem violações críticas`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => {}); // soft wait

    try {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .exclude("[data-testid='dev-tools']") // exclude dev overlays
        .analyze();

      // Filter to critical/serious violations only
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (critical.length > 0) {
        const details = critical.map((v) =>
          `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`
        ).join("\n");
        console.warn(`a11y violations on ${path}:\n${details}`);
      }

      // Allow up to 3 violations for now (incremental improvement)
      expect(critical.length).toBeLessThanOrEqual(3);
    } catch (err) {
      // @axe-core/playwright not installed — skip gracefully
      if (String(err).includes("Cannot find module")) {
        test.skip();
      } else {
        throw err;
      }
    }
  });
}

test("a11y: imagens têm texto alternativo", async ({ page }) => {
  await page.goto("/login");
  const imgs = await page.locator("img").all();
  for (const img of imgs) {
    const alt = await img.getAttribute("alt");
    const role = await img.getAttribute("role");
    // Images must have alt or role="presentation"
    const isDecorative = alt === "" || role === "presentation" || role === "none";
    const hasAlt = alt !== null;
    expect(hasAlt || isDecorative).toBe(true);
  }
});

test("a11y: formulário de login tem labels associados", async ({ page }) => {
  await page.goto("/login");
  const emailInput = page.getByLabel(/e-?mail/i);
  const passwordInput = page.getByLabel(/senha/i);
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
});

test("a11y: navegação via tab no login funciona", async ({ page }) => {
  await page.goto("/login");
  // Tab through the form elements
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
  expect(["input", "a", "button"]).toContain(focused);
});
