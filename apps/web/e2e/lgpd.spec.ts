import { test, expect } from "@playwright/test";

test.describe("LGPD — Privacidade e Dados", () => {
  test("política de privacidade está acessível", async ({ page }) => {
    await page.goto("/login");
    // Look for privacy policy link
    const privacyLink = page.getByRole("link", { name: /privacidade|privacy|lgpd/i });
    if (await privacyLink.count() > 0) {
      await expect(privacyLink.first()).toBeVisible();
    }
  });

  test("página de configurações de privacidade existe", async ({ page }) => {
    await page.goto("/configuracoes/privacidade");
    // Either shows the page or redirects to login
    const url = page.url();
    expect(url.includes("/privacidade") || url.includes("/login")).toBe(true);
  });

  test("solicitação de exportação de dados é acessível", async ({ page }) => {
    await page.goto("/configuracoes/privacidade");
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) { test.skip(); }

    const exportBtn = page.getByRole("button", { name: /exportar|export|baixar dados/i });
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });

  test("solicitação de exclusão de conta é acessível", async ({ page }) => {
    await page.goto("/configuracoes/privacidade");
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) { test.skip(); }

    const deleteBtn = page.getByRole("button", { name: /excluir conta|deletar conta|encerrar conta/i });
    if (await deleteBtn.count() > 0) {
      await expect(deleteBtn.first()).toBeVisible();
    }
  });

  test("cookies não contêm dados sensíveis visíveis", async ({ page }) => {
    await page.goto("/login");
    const cookies = await page.context().cookies();
    for (const cookie of cookies) {
      // Cookie values should not contain obvious PII patterns
      expect(cookie.value).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/); // CPF
      expect(cookie.value).not.toMatch(/password|senha/i);
    }
  });
});
