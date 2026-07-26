import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

test("login redirects to the dashboard and renders authenticated content", async ({ page }) => {
  await loginAsAdmin(page);
  // Same assertion smoke.sh's curl check uses, now verified through a real browser.
  await expect(page.getByText("Devedores", { exact: true })).toBeVisible();
});
