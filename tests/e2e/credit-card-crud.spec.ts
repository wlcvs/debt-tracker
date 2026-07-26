import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

test("create a credit card, see it in MethodSelect, then delete it", async ({ page }) => {
  const cardLabel = `E2E Card ${Date.now()}`;

  await loginAsAdmin(page);

  await page.getByPlaceholder("EX: NUBANK").fill(cardLabel);
  await page.getByPlaceholder("EX: NUBANK").locator("xpath=../..").getByRole("button", { name: "+", exact: true }).click();

  const cardRow = page.getByText(cardLabel, { exact: true }).locator("xpath=..");
  await expect(cardRow).toBeVisible();

  // Create a scratch person so we can confirm the new card shows up as a
  // MethodSelect option on the debt form, without actually creating a debt.
  const personName = `E2E CC Test Person ${Date.now()}`;
  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();

  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  await page.getByRole("button", { name: "— Método —" }).click();
  await expect(page.getByRole("button", { name: cardLabel, exact: true })).toBeVisible();
  // Click back on the dropdown toggle itself (inside the form, outside
  // MethodSelect's own open dropdown) to close just the dropdown — NOT
  // Escape, which also resets the whole form (see task/method-select-escape-guard).
  await page.getByRole("button", { name: "— Método —" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click(); // close the debt form

  // Clean up the scratch person first (no debts were created, so nothing
  // references the card yet).
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");

  // Delete the card.
  await cardRow.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await expect(page.getByText(cardLabel, { exact: true })).not.toBeVisible();
});

test("cannot delete a credit card that has a debt referencing it", async ({ page }) => {
  const cardLabel = `E2E Guarded Card ${Date.now()}`;
  const personName = `E2E CC Guard Person ${Date.now()}`;
  const debtTitle = `E2E CC Guard Debt ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  await loginAsAdmin(page);

  await page.getByPlaceholder("EX: NUBANK").fill(cardLabel);
  await page.getByPlaceholder("EX: NUBANK").locator("xpath=../..").getByRole("button", { name: "+", exact: true }).click();
  const cardRow = page.getByText(cardLabel, { exact: true }).locator("xpath=..");
  await expect(cardRow).toBeVisible();

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();

  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  await page.getByPlaceholder("TÍTULO").fill(debtTitle);
  await page.locator('input[name="amount"]').fill("42.00");
  await page.locator('input[name="date"]').fill(today);
  await page.getByRole("button", { name: "— Método —" }).click();
  await page.getByRole("button", { name: cardLabel, exact: true }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("button", { name: new RegExp(debtTitle) })).toBeVisible();

  // Go back to the dashboard and try to delete the card — must be blocked.
  await page.goto("/");
  await cardRow.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await expect(page.getByText("Este cartão possui dívidas registradas e não pode ser excluído.")).toBeVisible();
  await expect(cardRow).toBeVisible();

  // Clean up: delete the debt, then the person, then the now-unreferenced card.
  await page.getByRole("link", { name: personName }).click();
  await page.getByRole("button", { name: new RegExp(debtTitle) }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();

  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");

  await cardRow.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await expect(page.getByText(cardLabel, { exact: true })).not.toBeVisible();
});
