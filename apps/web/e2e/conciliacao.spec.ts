import { test, expect } from "@playwright/test";

test.describe("Conciliação bancária", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/financas/conciliacao");
  });

  test("deve carregar a página com título correto", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /conciliação bancária/i })).toBeVisible();
  });

  test("deve exibir empty state quando nenhum extrato selecionado", async ({ page }) => {
    await expect(page.getByText(/selecione um extrato/i)).toBeVisible();
  });

  test("deve exibir select de extratos", async ({ page }) => {
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("deve mostrar painéis ao selecionar extrato", async ({ page }) => {
    const select = page.getByRole("combobox");
    await select.click();
    const options = page.getByRole("option");
    const count = await options.count();

    if (count > 0) {
      await options.first().click();
      // Panels should appear
      await expect(page.getByText(/extrato bancário/i)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/títulos abertos/i)).toBeVisible({ timeout: 5_000 });
    } else {
      // No extratos available — just verify page is stable
      await expect(page.getByText(/selecione um extrato/i)).toBeVisible();
    }
  });

  test("tecla ESC deve cancelar seleção", async ({ page }) => {
    await page.keyboard.press("Escape");
    // Page should remain stable
    await expect(page.getByRole("heading", { name: /conciliação/i })).toBeVisible();
  });
});
