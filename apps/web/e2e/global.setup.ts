import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL ?? "test@moneymind.app";
  const password = process.env.E2E_PASSWORD ?? "testpassword123";

  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/inicio/, { timeout: 10_000 });
  await page.context().storageState({ path: authFile });
});
