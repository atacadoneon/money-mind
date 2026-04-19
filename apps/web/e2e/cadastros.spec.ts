import { test, expect } from "@playwright/test";

test.describe("Cadastros", () => {
  test("deve carregar clientes/fornecedores", async ({ page }) => {
    await page.goto("/cadastros/clientes-fornecedores");
    await expect(page.getByRole("heading", { name: /clientes|fornecedores/i })).toBeVisible();
  });

  test("deve abrir modal de novo contato", async ({ page }) => {
    await page.goto("/cadastros/clientes-fornecedores");
    const newButton = page.getByRole("button", { name: /novo contato|novo cliente|novo fornecedor/i });
    if (await newButton.isVisible()) {
      await newButton.click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
  });

  test("deve carregar categorias", async ({ page }) => {
    await page.goto("/cadastros/categorias");
    await expect(page.getByRole("heading", { name: /categoria/i })).toBeVisible();
  });
});
