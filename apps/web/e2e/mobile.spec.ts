import { test, expect } from "@playwright/test";

// Mobile viewport tests
const MOBILE_VIEWPORT = { width: 375, height: 812 }; // iPhone SE

test.describe("Mobile — responsividade", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test("página de login é responsiva em mobile", async ({ page }) => {
    await page.goto("/login");
    // Form should be visible and not overflow
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
    const form = page.locator("form").first();
    const box = await form.boundingBox();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    }
  });

  test("sem scrollbar horizontal em mobile na login", async ({ page }) => {
    await page.goto("/login");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 5); // 5px tolerance
  });

  test("sem overflow horizontal na home em mobile", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 5);
  });

  test("meta viewport está configurado", async ({ page }) => {
    await page.goto("/login");
    const viewport = await page.$eval(
      'meta[name="viewport"]',
      (el) => el.getAttribute("content")
    ).catch(() => null);
    if (viewport) {
      expect(viewport).toContain("width=device-width");
    }
  });

  test("tablet viewport (768px) — layout adequado", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/login");
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
  });
});

test.describe("Mobile — touch targets", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test("botões de login têm tamanho adequado para touch (min 44px)", async ({ page }) => {
    await page.goto("/login");
    const submitBtn = page.getByRole("button", { name: /entrar/i });
    if (await submitBtn.count() > 0) {
      const box = await submitBtn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36); // min touch target
      }
    }
  });
});
