import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

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
    await expect(
      page.locator("text=receberá").or(page.locator("text=enviado")).or(page.locator("text=email"))
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).not.toHaveURL("/login");
  });

  test("full reset flow: request token → reset → login with new password", async ({
    page,
  }) => {
    const prisma = new PrismaClient();
    const newPassword = `reset-${Date.now()}`;

    try {
      // 1. Submit forgot-password form
      await page.goto("/forgot-password");
      await page.fill('[name="email"]', E2E_EMAIL);
      await page.click('[type="submit"]');
      await page.waitForTimeout(500);

      // 2. Grab the token directly from DB (avoids real email delivery in tests)
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { user: { email: E2E_EMAIL } },
        orderBy: { createdAt: "desc" },
      });
      expect(tokenRecord).not.toBeNull();
      const token = tokenRecord!.token;

      // 3. Visit the reset link
      await page.goto(`/reset-password/${token}`);
      await expect(page.locator('[name="password"]')).toBeVisible();

      // 4. Set new password
      await page.fill('[name="password"]', newPassword);
      await page.click('[type="submit"]');

      // 5. Should redirect to /login or show success
      await page.waitForURL(/login/, { timeout: 8_000 });

      // 6. Login with new password
      await page.fill('[name="email"]', E2E_EMAIL);
      await page.fill('[name="password"]', newPassword);
      await page.click('[type="submit"]');
      await page.waitForURL("/", { timeout: 8_000 });
      await expect(page.locator("text=Debt Tracker").first()).toBeVisible();

      // 7. Restore original password for other tests
      const { hash } = await import("bcryptjs");
      await prisma.user.update({
        where: { email: E2E_EMAIL },
        data: { passwordHash: await hash(E2E_PASSWORD, 12) },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test("expired/invalid token shows error", async ({ page }) => {
    await page.goto("/reset-password/token-invalido-9999");
    // Should not crash — show an error or redirect
    await expect(
      page.locator("text=inválid").or(page.locator("text=expirad")).or(page.locator("text=404"))
    ).toBeVisible({ timeout: 5_000 });
  });
});
