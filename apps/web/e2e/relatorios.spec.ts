import { test, expect } from "@playwright/test";

test.describe("Relatórios", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/financas/relatorios");
  });

  test("deve carregar a página com título correto", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /relatórios/i })).toBeVisible();
  });

  test("deve exibir as 4 abas", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /dre/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /fluxo/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /categoria/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /contatos/i })).toBeVisible();
  });

  test("deve renderizar aba DRE com DateRangePicker", async ({ page }) => {
    await page.getByRole("tab", { name: /dre/i }).click();
    await expect(page.getByRole("button", { name: /selecionar período/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /gerar dre/i })).toBeVisible();
  });

  test("deve renderizar aba Fluxo de Caixa", async ({ page }) => {
    await page.getByRole("tab", { name: /fluxo/i }).click();
    await expect(page.getByRole("button", { name: /30 dias/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /60 dias/i })).toBeVisible();
  });

  test("deve renderizar aba Por Categoria", async ({ page }) => {
    await page.getByRole("tab", { name: /categoria/i }).click();
    await expect(page.getByRole("combobox")).toBeVisible(); // tipo select
    await expect(page.getByRole("button", { name: /filtrar/i })).toBeVisible();
  });

  test("deve renderizar aba Top Contatos", async ({ page }) => {
    await page.getByRole("tab", { name: /contatos/i }).click();
    await expect(page.getByRole("combobox")).toBeVisible(); // tipo select
    await expect(page.getByRole("button", { name: /filtrar/i })).toBeVisible();
  });
});
