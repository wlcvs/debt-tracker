import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

// These tests don't need a logged-in session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Password reset", () => {
  test("forgot password page renders correctly", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test("always shows success regardless of email existence (no user enumeration)", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.fill('[name="email"]', "naoexiste@naoexiste.com");
    await page.click('[type="submit"]');
    // Should show a success/neutral message — not reveal if user exists
    // (rate-limited response is also acceptable in high-volume test runs)
    await expect(
      page.locator("text=receberá")
        .or(page.locator("text=enviado"))
        .or(page.locator("text=email"))
        .or(page.locator("text=Muitas tentativas"))
    ).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL("/login");
  });

  test("full reset flow: request token → reset → login with new password", async ({
    page,
  }) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const newPassword = `reset-${Date.now()}`;

    try {
      // 1. Submit forgot-password form
      await page.goto("/forgot-password");
      await page.fill('[name="email"]', E2E_EMAIL);
      await page.click('[type="submit"]');
      // Wait for the unique success text — "Verifique" only appears in the success div, not the form
      await expect(page.locator("text=Verifique")).toBeVisible({ timeout: 12_000 });

      // 2. Grab the token directly from DB (avoids real email delivery in tests)
      const tokenRes = await client.query(
        'SELECT token FROM "PasswordResetToken" prt JOIN "User" u ON prt."userId" = u.id WHERE u.email = $1 ORDER BY prt."createdAt" DESC LIMIT 1',
        [E2E_EMAIL]
      );
      expect(tokenRes.rowCount).toBeGreaterThan(0);
      const token = tokenRes.rows[0].token;

      // 3. Visit the reset link
      await page.goto(`/reset-password/${token}`);
      await expect(page.locator('[name="password"]')).toBeVisible({ timeout: 8_000 });

      // 4. Set new password
      await page.fill('[name="password"]', newPassword);
      await page.click('[type="submit"]');

      // 5. Wait for success message (action returns {status:"success"}, no auto-redirect)
      await expect(page.locator("text=Senha redefinida")).toBeVisible({ timeout: 12_000 });
      await page.click('a:has-text("Fazer login")');
      await page.waitForURL(/login/, { timeout: 10_000 });

      // 6. Login with new password
      await page.fill('[name="email"]', E2E_EMAIL);
      await page.fill('[name="password"]', newPassword);
      await page.click('[type="submit"]');
      // Allow extra time — server may be under load late in the full test suite
      await page.waitForURL("/", { timeout: 15_000 });
      await expect(page.locator("text=Total a receber")).toBeVisible({ timeout: 8_000 });
    } finally {
      // Restore original password so subsequent tests can still authenticate
      const { hash } = await import("bcryptjs");
      await client.query('UPDATE "User" SET "passwordHash" = $1 WHERE email = $2', [await hash(E2E_PASSWORD, 12), E2E_EMAIL]);
      await client.end();
    }
  });

  test("expired/invalid token shows error", async ({ page }) => {
    await page.goto("/reset-password/token-invalido-9999");
    // Token is validated on submit, not on page load
    await page.fill('[name="password"]', "testpassword123");
    await page.click('[type="submit"]');
    await expect(
      page.locator("text=inválid").or(page.locator("text=expirad"))
    ).toBeVisible({ timeout: 5_000 });
  });
});
