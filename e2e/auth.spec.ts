import { test, expect } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

// These tests run without the stored auth state — they test the login flow itself
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
  test("redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows login page with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
    await expect(page.locator('[type="submit"]')).toBeVisible();
  });

  test("shows forgot password link on login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
  });

  test("logs in successfully with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_EMAIL);
    await page.fill('[name="password"]', E2E_PASSWORD);
    await page.click('[type="submit"]');
    await page.waitForURL("/", { timeout: 10_000 });
    await expect(page.locator("text=Debt Tracker").filter({ visible: true }).first()).toBeVisible();
  });

  test("stays on login with wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_EMAIL);
    await page.fill('[name="password"]', "wrongpassword");
    await page.click('[type="submit"]');
    // Should not navigate to /
    await expect(page).not.toHaveURL("/");
  });

  test("forgot password page renders form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[type="submit"]')).toBeVisible();
  });

  test("forgot password always shows success (no user enumeration)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.fill('[name="email"]', "nonexistent@example.com");
    await page.click('[type="submit"]');
    await expect(page.locator("text=enviado")).toBeVisible({ timeout: 10_000 });
  });
});
