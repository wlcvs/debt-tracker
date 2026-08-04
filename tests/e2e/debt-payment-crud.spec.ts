import { test, expect } from "@playwright/test";
import { loginAsAdmin, fillDate } from "./fixtures";

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
  await fillDate(page, today);
  await page.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Pix" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();

  // Scoped to the debt row itself — "R$ 199,90" alone is ambiguous here,
  // since this person's very first debt also matches their total-balance
  // display in the page header.
  const debtRow = page.getByRole("button", { name: new RegExp(debtTitle) });
  await expect(debtRow).toBeVisible();
  await expect(debtRow).toContainText("R$ 199,90");

  // --- Open the debt's detail modal (ModalShell) and close it both ways ---
  await debtRow.click();
  await expect(page.getByText("Dívida", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar como paga" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("Dívida", { exact: true })).not.toBeVisible();

  await debtRow.click();
  await expect(page.getByText("Dívida", { exact: true })).toBeVisible();
  await page.mouse.click(5, 5); // backdrop click
  await expect(page.getByText("Dívida", { exact: true })).not.toBeVisible();

  // --- Add a payment ---
  await page.getByRole("button", { name: "+ Adicionar pagamento" }).click();
  await page.locator('input[name="amount"]').fill("50.00");
  await fillDate(page, today);
  await page.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Dinheiro" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("R$ 50,00")).toBeVisible();

  // Clean up the person this test created — through the real UI delete flow,
  // both as cleanup and as incidental coverage of that flow. Without this,
  // every run leaves a stray "E2E Test Person <timestamp>" cluttering the
  // dashboard's debtor list.
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: personName })).not.toBeVisible();
});
