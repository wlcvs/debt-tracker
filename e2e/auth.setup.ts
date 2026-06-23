import { test as setup, expect } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

const authFile = "e2e/.auth/user.json";

setup("authenticate as test user", async ({ page }) => {
  await page.goto("/login");

  await page.fill('[name="email"]', E2E_EMAIL);
  await page.fill('[name="password"]', E2E_PASSWORD);
  await page.click('[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL("/", { timeout: 10_000 });
  await expect(page.locator("text=Debt Tracker")).toBeVisible();

  // Save authenticated session to disk for other tests
  await page.context().storageState({ path: authFile });
});
