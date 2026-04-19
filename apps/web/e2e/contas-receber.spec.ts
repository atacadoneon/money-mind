import { test, expect } from "@playwright/test";

test.describe("Contas a receber", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/financas/contas-a-receber");
  });

  test("deve carregar a página com título correto", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /contas a receber/i })).toBeVisible();
  });

  test("deve exibir tabs de status", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /todas/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /recebidas/i })).toBeVisible();
  });

  test("deve abrir modal nova conta ao clicar no botão", async ({ page }) => {
    await page.getByRole("button", { name: /nova conta/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("deve abrir filtros avançados com label cliente", async ({ page }) => {
    await page.getByRole("button", { name: /mais filtros/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/cliente/i)).toBeVisible();
  });

  test("deve filtrar por status recebidas", async ({ page }) => {
    await page.getByRole("tab", { name: /recebidas/i }).click();
    await expect(page.getByRole("heading", { name: /contas a receber/i })).toBeVisible();
  });
});
