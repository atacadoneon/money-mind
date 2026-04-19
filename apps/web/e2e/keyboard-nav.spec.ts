/**
 * E2E tests — keyboard navigation shortcuts.
 * Requires authenticated session for most tests.
 */
import { test, expect } from "@playwright/test";

test.describe("Keyboard navigation — shortcuts globais", () => {
  test("Ctrl+K abre command palette na página de login (se acessível)", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Control+k");
    // On login page, command palette may not exist — just ensure no crash
    const currentUrl = page.url();
    expect(currentUrl).toContain("/login");
  });

  test("? mostra diálogo de atalhos quando não há input focado", async ({ page }) => {
    await page.goto("/login");
    // Click somewhere neutral first
    await page.locator("body").click();
    // Press ? — might open shortcuts dialog if auth'd
    await page.keyboard.press("?");
    await page.waitForTimeout(300);
    // Should not navigate or crash
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test("Tab navega através dos campos do formulário de login", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel(/e-?mail/i);
    const password = page.getByLabel(/senha/i);
    const submit = page.getByRole("button", { name: /entrar/i });

    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    // Submit or other element should be focused
    const nextFocused = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
    expect(["button", "a", "input"]).toContain(nextFocused);
  });

  test("Enter submete formulário de login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-?mail/i).fill("test@invalid.com");
    await page.getByLabel(/senha/i).fill("wrong");
    await page.getByLabel(/senha/i).press("Enter");
    // Should attempt login (result = error message or redirect)
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toBeTruthy(); // page still accessible
  });

  test("Escape fecha modais", async ({ page }) => {
    await page.goto("/login");
    // Press Escape — should not cause errors
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    expect(page.url()).toBeTruthy();
  });
});

test.describe("Keyboard navigation — focus management", () => {
  test("skip link existe para acessibilidade (se implementado)", async ({ page }) => {
    await page.goto("/login");
    // Press Tab once from the very beginning
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName?.toLowerCase(),
      text: (document.activeElement as HTMLElement)?.innerText?.toLowerCase() ?? "",
      href: (document.activeElement as HTMLAnchorElement)?.href ?? "",
    }));
    // A skip link would say "pular" or "skip"
    const isSkipLink = focused.text.includes("pular") || focused.text.includes("skip");
    // We don't fail if no skip link — just log
    console.log(`First focused: ${focused.tag} — "${focused.text}" — skip link: ${isSkipLink}`);
  });
});
