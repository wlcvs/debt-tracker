import { test, expect } from "@playwright/test";

test.describe("Dashboard overview", () => {
  test("shows total to receive and stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Total a receber")).toBeVisible();
    await expect(page.locator("text=Devedores ativos")).toBeVisible();
    await expect(page.locator("text=Total de pessoas")).toBeVisible();
  });

  test("shows sidebar with Debt Tracker heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Debt Tracker").first()).toBeVisible();
  });

  test("can add a new person via sidebar form", async ({ page }) => {
    await page.goto("/");

    const uniqueName = `E2E-PESSOA-${Date.now()}`;
    await page.fill('[name="name"]', uniqueName);
    await page.click('[type="submit"]');

    // Person should appear in the sidebar list
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 8_000 });
  });

  test("sidebar search filters people by name", async ({ page }) => {
    await page.goto("/");

    // Add a uniquely named person first
    const name = `BUSCA-${Date.now()}`;
    await page.fill('[name="name"]', name);
    await page.click('[type="submit"]');
    await page.waitForSelector(`text=${name}`);

    // Search for them
    await page.fill('[placeholder*="BUSCAR"]', name);
    await expect(page.locator(`text=${name}`)).toBeVisible();
  });

  test("shows credit cards section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Cartões")).toBeVisible();
  });

  test("can add and see a credit card", async ({ page }) => {
    await page.goto("/");
    const label = `CARD-${Date.now()}`;
    await page.fill('[placeholder*="NUBANK"]', label);
    // Click the + button next to the card input
    await page.locator('form:has([placeholder*="NUBANK"]) [type="submit"]').click();
    await expect(page.locator(`text=${label.toUpperCase()}`)).toBeVisible({ timeout: 8_000 });
  });
});
