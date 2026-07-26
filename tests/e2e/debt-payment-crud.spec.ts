import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

test("add a debt and a payment for a newly created person", async ({ page }) => {
  const personName = `E2E Test Person ${Date.now()}`;
  const debtTitle = `E2E Debt ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  await loginAsAdmin(page);

  // Create a fresh person inline so this test is self-contained and its
  // assertions never collide with pre-existing data on someone else's page.
  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();
  await expect(page.getByRole("heading", { name: personName })).toBeVisible();

  // --- Add a debt ---
  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  await page.getByPlaceholder("TÍTULO").fill(debtTitle);
  await page.locator('input[name="amount"]').fill("199.90");
  await page.locator('input[name="date"]').fill(today);
  await page.getByRole("button", { name: "— Método —" }).click();
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Salvar" }).click();

  // Scoped to the debt row itself — "R$ 199.90" alone is ambiguous here,
  // since this person's very first debt also matches their total-balance
  // display in the page header.
  const debtRow = page.getByRole("button", { name: new RegExp(debtTitle) });
  await expect(debtRow).toBeVisible();
  await expect(debtRow).toContainText("R$ 199.90");

  // --- Add a payment ---
  await page.getByRole("button", { name: "+ Adicionar pagamento" }).click();
  await page.locator('input[name="amount"]').fill("50.00");
  await page.locator('input[name="date"]').fill(today);
  await page.getByRole("button", { name: "— Método —" }).click();
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("R$ 50.00")).toBeVisible();
});
