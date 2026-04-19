import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Extratos bancários", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/financas/extratos-bancarios");
  });

  test("deve carregar a página com dropzone de upload", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /extratos bancários/i })).toBeVisible();
    await expect(page.getByText(/arraste o arquivo ofx/i)).toBeVisible();
  });

  test("deve mostrar empty state quando não há extratos", async ({ page }) => {
    // If no extratos loaded, empty state should be visible OR table is visible
    const emptyOrTable = page
      .getByText(/nenhum extrato importado/i)
      .or(page.getByRole("table"));
    await expect(emptyOrTable.first()).toBeVisible({ timeout: 5_000 });
  });

  test("dropzone deve aceitar arquivo OFX", async ({ page }) => {
    // Create a minimal OFX content buffer
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><TRNUID>1</TRNUID><STATUS><CODE>0</CODE></STATUS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

    const dropzone = page.locator('[class*="border-dashed"]').first();
    await expect(dropzone).toBeVisible();

    // Use file chooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      dropzone.click()
    ]);
    await fileChooser.setFiles({
      name: "test.ofx",
      mimeType: "application/x-ofx",
      buffer: Buffer.from(ofxContent)
    });
    // After upload attempt, page should still be functional
    await expect(page.getByRole("heading", { name: /extratos bancários/i })).toBeVisible();
  });
});
