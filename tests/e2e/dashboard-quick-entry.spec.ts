import { test, expect } from "@playwright/test";
import { loginAsAdmin, fillDate } from "./fixtures";

/**
 * The dashboard's "+ Lançamento" modal, whose whole reason to exist is entering a
 * run of items for different people without a round trip through /person/[code].
 * So the meaningful path is not "one debt saves" but "two debts, two debtors, one
 * modal opening" — that is what this drives.
 *
 * Both fixture people are named with the `E2E ` prefix so global-cleanup.ts sweeps
 * them even if an assertion below fails before the cleanup at the end runs.
 */
test("log debts for two different debtors without leaving the dashboard", async ({ page }) => {
  const stamp = Date.now();
  const personA = `E2E Quick A ${stamp}`;
  const personB = `E2E Quick B ${stamp}`;
  const debtA = `E2E Debt A ${stamp}`;
  const debtB = `E2E Debt B ${stamp}`;
  const today = new Date().toISOString().slice(0, 10);

  await loginAsAdmin(page);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personA);
  await newPersonInput.press("Enter");
  await expect(page.getByRole("link", { name: personA })).toBeVisible();
  await newPersonInput.fill(personB);
  await newPersonInput.press("Enter");
  await expect(page.getByRole("link", { name: personB })).toBeVisible();

  await page.getByRole("button", { name: "+ Lançamento" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByText("Novo lançamento")).toBeVisible();

  // --- First debt, for person A ---
  await modal.getByRole("button", { name: "Devedor" }).click();
  await page.getByRole("button", { name: personA, exact: true }).click();

  await modal.getByPlaceholder("TÍTULO").fill(debtA);
  await modal.locator('input[name="amount"]').fill("199,90");
  await fillDate(modal, today);
  await modal.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Pix" }).click();
  await modal.getByRole("button", { name: "Salvar" }).click();

  // Still open, ready for the next entry — the point of the whole feature.
  await expect(modal.getByText("Dívida salva.")).toBeVisible();
  await expect(modal.getByPlaceholder("TÍTULO")).toHaveValue("");

  // --- Second debt, for person B, without reopening anything ---
  await modal.getByRole("button", { name: "Devedor" }).click();
  await page.getByRole("button", { name: personB, exact: true }).click();

  await modal.getByPlaceholder("TÍTULO").fill(debtB);
  await modal.locator('input[name="amount"]').fill("50,00");
  // The date deliberately survives the first save, so it is not filled again.
  await modal.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Dinheiro" }).click();
  await modal.getByRole("button", { name: "Salvar" }).click();
  await expect(modal.getByText("Dívida salva.")).toBeVisible();

  await modal.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // --- Each debt landed on the right person ---
  await page.getByRole("link", { name: personA }).click();
  await expect(page.getByRole("button", { name: new RegExp(debtA) })).toContainText("R$ 199,90");
  await expect(page.getByRole("button", { name: new RegExp(debtB) })).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("link", { name: personB }).click();
  await expect(page.getByRole("button", { name: new RegExp(debtB) })).toContainText("R$ 50,00");

  // --- Clean up both fixture people through the real delete flow ---
  for (const name of [personB, personA]) {
    await page.goto("/");
    await page.getByRole("link", { name }).click();
    await page.getByRole("button", { name: "Excluir devedor" }).click();
    await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  }
});

test("refuses to save without a debtor", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole("button", { name: "+ Lançamento" }).click();
  const modal = page.getByRole("dialog");

  await modal.getByPlaceholder("TÍTULO").fill("E2E No Debtor");
  await modal.locator('input[name="amount"]').fill("10,00");
  await fillDate(modal, new Date().toISOString().slice(0, 10));
  await modal.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Pix" }).click();
  await modal.getByRole("button", { name: "Salvar" }).click();

  await expect(modal.getByText("Selecione o devedor.")).toBeVisible();
  // Nothing was thrown away, so the entry can be completed rather than retyped.
  await expect(modal.getByPlaceholder("TÍTULO")).toHaveValue("E2E No Debtor");
});
