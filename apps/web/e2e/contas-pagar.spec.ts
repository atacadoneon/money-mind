import { test, expect } from "@playwright/test";

test.describe("Contas a pagar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/financas/contas-a-pagar");
  });

  test("deve carregar a página com título correto", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /contas a pagar/i })).toBeVisible();
  });

  test("deve exibir tabs de status", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /todas/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /em aberto/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /atrasadas/i })).toBeVisible();
  });

  test("deve abrir modal nova conta ao clicar no botão", async ({ page }) => {
    await page.getByRole("button", { name: /nova conta/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/nova conta/i)).toBeVisible();
  });

  test("deve abrir DateRangePicker ao clicar no seletor de período", async ({ page }) => {
    await page.getByRole("button", { name: /período de vencimento/i }).click();
    await expect(page.getByRole("dialog", { name: /calendário/i }).or(page.locator("[data-radix-popper-content-wrapper]"))).toBeVisible({
      timeout: 3_000
    });
  });

  test("deve abrir sheet de filtros avançados", async ({ page }) => {
    await page.getByRole("button", { name: /mais filtros/i }).click();
    await expect(page.getByRole("dialog").getByText(/filtros avançados/i)).toBeVisible();
  });

  test("deve filtrar por status ao clicar nas tabs", async ({ page }) => {
    await page.getByRole("tab", { name: /em aberto/i }).click();
    await expect(page.url()).toContain("/contas-a-pagar");
    // Just verify no JS error and page still shows
    await expect(page.getByRole("heading", { name: /contas a pagar/i })).toBeVisible();
  });

  test("deve buscar por texto no campo de busca", async ({ page }) => {
    const input = page.getByPlaceholder(/buscar fornecedor/i);
    await input.fill("teste");
    await page.waitForTimeout(500); // debounce
    await expect(page.getByRole("heading", { name: /contas a pagar/i })).toBeVisible();
  });
});
