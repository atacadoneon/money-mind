import { test, expect } from "@playwright/test";

// These tests run without stored auth
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Autenticação", () => {
  test("deve redirecionar para login quando não autenticado", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/login/);
  });

  test("deve mostrar formulário de login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /entrar|login/i })).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("deve exibir erro com credenciais inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill("invalido@test.com");
    await page.getByLabel(/senha/i).fill("senhaerrada");
    await page.getByRole("button", { name: /entrar/i }).click();
    // Expect error toast or message
    await expect(page.locator("[data-sonner-toast], .text-destructive").first()).toBeVisible({
      timeout: 5_000
    });
  });
});
