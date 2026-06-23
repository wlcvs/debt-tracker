import { test, expect } from "@playwright/test";

test.describe("Person detail", () => {
  let personName: string;

  test.beforeEach(async ({ page }) => {
    // Create a fresh person before each test
    personName = `E2E-${Date.now()}`;
    await page.goto("/");
    await page.fill('[name="name"]', personName);
    await page.click('[type="submit"]');
    await page.locator(`text=${personName}`).click();
    await page.waitForURL(/\/pessoa\//);
  });

  test("shows person name and R$ 0.00 balance", async ({ page }) => {
    await expect(page.locator(`text=${personName}`)).toBeVisible();
    await expect(page.locator("text=R$ 0.00")).toBeVisible();
  });

  test("shows share button", async ({ page }) => {
    await expect(page.locator("text=COMPARTILHAR")).toBeVisible();
  });

  test("can add a debt and see balance update", async ({ page }) => {
    await page.fill('[name="amount"]', "150");
    await page.fill('[name="description"]', "Almoço E2E");
    await page.fill('[name="date"]', "2025-06-01");
    await page.locator('form:has([name="description"]) [type="submit"]').click();

    await expect(page.locator("text=Almoço E2E")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("text=R$ 150.00")).toBeVisible();
  });

  test("can add a payment and see balance decrease", async ({ page }) => {
    // Add debt first
    await page.fill('[name="amount"]', "200");
    await page.fill('[name="description"]', "Cinema E2E");
    await page.fill('[name="date"]', "2025-06-01");
    await page.locator('form:has([name="description"]) [type="submit"]').click();
    await expect(page.locator("text=R$ 200.00")).toBeVisible({ timeout: 8_000 });

    // Add payment
    await page.locator('form:has([name="personId"]):not(:has([name="description"])) [name="amount"]').fill("50");
    await page.locator('form:has([name="personId"]):not(:has([name="description"])) [name="date"]').fill("2025-07-01");
    await page.locator('form:has([name="personId"]):not(:has([name="description"])) [type="submit"]').click();

    // Balance should decrease: 200 - 50 = 150
    await expect(page.locator("text=R$ 150.00")).toBeVisible({ timeout: 8_000 });
  });

  test("can delete a debt", async ({ page }) => {
    // Add a debt
    await page.fill('[name="amount"]', "99");
    await page.fill('[name="description"]', "DELETE-ME");
    await page.fill('[name="date"]', "2025-06-01");
    await page.locator('form:has([name="description"]) [type="submit"]').click();
    await expect(page.locator("text=DELETE-ME")).toBeVisible({ timeout: 8_000 });

    // Click ✕ next to the debt
    await page.locator("li:has-text('DELETE-ME') button[title='Remover']").click();
    await expect(page.locator("text=DELETE-ME")).not.toBeVisible({ timeout: 8_000 });
  });

  test("can edit a debt description", async ({ page }) => {
    await page.fill('[name="amount"]', "77");
    await page.fill('[name="description"]', "ORIGINAL");
    await page.fill('[name="date"]', "2025-06-01");
    await page.locator('form:has([name="description"]) [type="submit"]').click();
    await expect(page.locator("text=ORIGINAL")).toBeVisible({ timeout: 8_000 });

    // Click edit ✎
    await page.locator("li:has-text('ORIGINAL') button[title='Editar']").click();

    // Clear and type new description
    const descInput = page.locator("li input[name='description']");
    await descInput.fill("EDITADO");
    await page.locator("li button:has-text('Salvar')").click();

    await expect(page.locator("text=EDITADO")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("text=ORIGINAL")).not.toBeVisible();
  });

  test("share button copies consultar URL to clipboard", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.locator("text=COMPARTILHAR").click();
    await expect(page.locator("text=COPIADO")).toBeVisible({ timeout: 3_000 });

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("/consultar/");
  });
});
