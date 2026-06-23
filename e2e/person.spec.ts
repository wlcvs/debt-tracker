import { test, expect } from "@playwright/test";

test.describe("Person detail", () => {
  let personName: string;
  let isMobile: boolean;

  test.beforeEach(async ({ page }) => {
    // Create a fresh person before each test
    personName = `E2E-${Date.now()}`;
    await page.goto("/");

    const mobileMenu = page.locator('button:has-text("☰")');
    isMobile = await mobileMenu.isVisible({ timeout: 500 });

    if (isMobile) {
      await mobileMenu.click();
    }

    await page.locator('[name="name"]').filter({ visible: true }).fill(personName);
    await page.locator('form:has([name="name"]) [type="submit"]').filter({ visible: true }).click();

    // Wait for person link to appear in DOM (server action + revalidatePath completed)
    // .first() because when drawer is open, the link exists in BOTH the desktop aside and mobile drawer
    await page.locator(`a:has-text("${personName}")`).first().waitFor({ state: "attached", timeout: 10_000 });

    // On mobile, the drawer STAYS OPEN after revalidatePath (DashboardShell client state persists).
    // The person link is visible in the open drawer — click it directly without reopening.
    await page.locator(`text=${personName}`).filter({ visible: true }).first().click();
    await page.waitForURL(/\/person\//);

    // Close the mobile drawer after navigation so the person page content (debt form) is accessible.
    // The drawer's z-40 overlay would otherwise intercept all clicks on the main content area.
    // Scope to the drawer overlay (div with fixed+inset-0 classes) to avoid matching "Excluir pessoa" button.
    if (isMobile) {
      const closeDrawerBtn = page.locator('[class*="fixed"][class*="inset-0"] button:has-text("✕")');
      if (await closeDrawerBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await closeDrawerBtn.click();
        await closeDrawerBtn.waitFor({ state: "hidden", timeout: 2_000 });
      }
    }
  });

  test("shows person name and R$ 0.00 balance", async ({ page }) => {
    // On mobile the sidebar is hidden so .first() would pick the hidden element — filter to visible
    await expect(page.locator(`text=${personName}`).filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator("text=R$ 0.00").filter({ visible: true }).first()).toBeVisible();
  });

  test("shows share button", async ({ page }) => {
    await expect(page.locator("text=COMPARTILHAR")).toBeVisible();
  });

  test("can add a debt and see balance update", async ({ page }) => {
    const debtForm = page.locator('form:has(input[name="description"])');
    await debtForm.locator('input[name="amount"]').fill("150");
    await debtForm.locator('input[name="description"]').fill("Almoco E2E");
    await debtForm.locator('input[name="date"]').fill("2025-06-01");
    await debtForm.locator('[type="submit"]').click();

    // Description appears in debt list span AND payment select option; filter to visible
    await expect(page.locator("text=Almoco E2E").filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 });
    // Amount appears in sidebar chip (hidden on mobile), header, debt span; filter to visible
    await expect(page.locator("text=R$ 150.00").filter({ visible: true }).first()).toBeVisible();
  });

  test("can add a payment and see balance decrease", async ({ page }) => {
    // Add debt first
    const debtForm = page.locator('form:has(input[name="description"])');
    await debtForm.locator('input[name="amount"]').fill("200");
    await debtForm.locator('input[name="description"]').fill("Cinema E2E");
    await debtForm.locator('input[name="date"]').fill("2025-06-01");
    await debtForm.locator('[type="submit"]').click();
    await expect(page.locator("text=R$ 200.00").filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 });

    // Add payment
    await page.locator('form:has([name="personId"]):not(:has([name="description"])) [name="amount"]').fill("50");
    await page.locator('form:has([name="personId"]):not(:has([name="description"])) [name="date"]').fill("2025-07-01");
    await page.locator('form:has([name="personId"]):not(:has([name="description"])) [type="submit"]').click();

    // Balance should decrease: 200 - 50 = 150
    await expect(page.locator("text=R$ 150.00").filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 });
  });

  test("can delete a debt", async ({ page }) => {
    // Add a debt
    const debtForm = page.locator('form:has(input[name="description"])');
    await debtForm.locator('input[name="amount"]').fill("99");
    await debtForm.locator('input[name="description"]').fill("DELETE-ME");
    await debtForm.locator('input[name="date"]').fill("2025-06-01");
    await debtForm.locator('[type="submit"]').click();
    await expect(page.locator("text=DELETE-ME").filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 });

    // Click ✕ next to the debt — use li selector to avoid matching select option
    await page.locator("li:has-text('DELETE-ME') button[title='Remover']").click();
    await expect(page.locator("li:has-text('DELETE-ME')")).not.toBeVisible({ timeout: 8_000 });
  });

  test("can edit a debt description", async ({ page }) => {
    const debtForm = page.locator('form:has(input[name="description"])');
    await debtForm.locator('input[name="amount"]').fill("77");
    await debtForm.locator('input[name="description"]').fill("ORIGINAL");
    await debtForm.locator('input[name="date"]').fill("2025-06-01");
    await debtForm.locator('[type="submit"]').click();
    await expect(page.locator("text=ORIGINAL").filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 });

    // Click edit ✎
    await page.locator("li:has-text('ORIGINAL') button[title='Editar']").click();

    // Clear and type new description
    const descInput = page.locator("li input[name='description']");
    await descInput.fill("EDITADO");
    await page.locator("li button:has-text('Salvar')").click();

    await expect(page.locator("text=EDITADO").filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("text=ORIGINAL")).not.toBeVisible();
  });

  test("share button copies public URL to clipboard", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.locator("text=COMPARTILHAR").click();
    await expect(page.locator("text=COPIADO")).toBeVisible({ timeout: 3_000 });

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("/public/");
  });
});
