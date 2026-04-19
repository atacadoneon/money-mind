import { test, expect } from "@playwright/test";

test.describe("Import Wizard", () => {
  test("deve abrir wizard de importação em Contas a Pagar", async ({ page }) => {
    await page.goto("/financas/contas-a-pagar");
    await page.getByRole("button", { name: /importar/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/importar contas a pagar/i)).toBeVisible();
  });

  test("deve mostrar o step 1 (upload) por padrão", async ({ page }) => {
    await page.goto("/financas/contas-a-pagar");
    await page.getByRole("button", { name: /importar/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/arraste seu arquivo/i)).toBeVisible();
  });

  test("deve permitir upload de arquivo CSV e avançar para mapeamento", async ({ page }) => {
    await page.goto("/financas/contas-a-pagar");
    await page.getByRole("button", { name: /importar/i }).click();
    const dialog = page.getByRole("dialog");

    const csvContent = "historico,valor,dataVencimento\nPagamento fornecedor,1500.00,2024-12-31";
    const dropzone = dialog.locator('[class*="border-dashed"]').first();

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      dropzone.click()
    ]);

    await fileChooser.setFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent)
    });

    // Should advance to step 2 (mapping)
    await expect(dialog.getByText(/mapeie as colunas/i)).toBeVisible({ timeout: 5_000 });
  });

  test("deve fechar wizard ao clicar cancelar", async ({ page }) => {
    await page.goto("/financas/contas-a-pagar");
    await page.getByRole("button", { name: /importar/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /cancelar/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });
  });
});
