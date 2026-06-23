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
    await expect(page.locator("text=Debt Tracker").filter({ visible: true }).first()).toBeVisible();
  });

  test("can add a new person via sidebar form", async ({ page }) => {
    await page.goto("/");

    const mobileMenu = page.locator('button:has-text("☰")');
    const isMobile = await mobileMenu.isVisible({ timeout: 500 });

    if (isMobile) {
      await mobileMenu.click();
    }

    const uniqueName = `E2E-PESSOA-${Date.now()}`;
    await page.locator('[name="name"]').filter({ visible: true }).fill(uniqueName);
    await page.locator('form:has([name="name"]) [type="submit"]').filter({ visible: true }).click();

    // Wait for person link to appear in DOM (server action completed)
    // .first() because when drawer is open, the link exists in both desktop aside and mobile drawer
    await page.locator(`a:has-text("${uniqueName}")`).first().waitFor({ state: "attached", timeout: 10_000 });

    // On mobile, the drawer STAYS OPEN after revalidatePath (client state persists)
    // Person is already visible in the open drawer — just verify it
    await expect(page.locator(`text=${uniqueName}`).filter({ visible: true })).toBeVisible({ timeout: 8_000 });
  });

  test("sidebar search filters people by name", async ({ page }) => {
    await page.goto("/");

    const mobileMenu = page.locator('button:has-text("☰")');
    const isMobile = await mobileMenu.isVisible({ timeout: 500 });

    if (isMobile) {
      await mobileMenu.click();
    }

    // Add a uniquely named person first
    const name = `BUSCA-${Date.now()}`;
    await page.locator('[name="name"]').filter({ visible: true }).fill(name);
    await page.locator('form:has([name="name"]) [type="submit"]').filter({ visible: true }).click();

    // Wait for person link to appear in DOM
    await page.locator(`a:has-text("${name}")`).first().waitFor({ state: "attached", timeout: 10_000 });

    // Drawer stays open on mobile — search input is visible in the sidebar
    // Search for them
    await page.locator('[placeholder*="BUSCAR"]').filter({ visible: true }).fill(name);
    await expect(page.locator(`text=${name}`).filter({ visible: true })).toBeVisible();
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
