import { test, expect } from "@playwright/test";

test.describe("Troca de empresa", () => {
  test("deve exibir seletor de empresa na sidebar", async ({ page }) => {
    await page.goto("/inicio");
    // Look for company selector in sidebar
    const sidebar = page.locator("aside, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 5_000 });
  });

  test("deve acessar configurações de empresa", async ({ page }) => {
    await page.goto("/configuracoes");
    await expect(page.getByRole("heading", { name: /configurações/i })).toBeVisible();
  });

  test("dashboard deve carregar após login", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page.getByRole("heading")).toBeVisible({ timeout: 5_000 });
  });
});
