import { test, expect } from "@playwright/test";
import { loginAsAdmin, fillDate } from "./fixtures";

test("edit and delete an existing debt", async ({ page }) => {
  const personName = `E2E Edit Person ${Date.now()}`;
  const debtTitle = `E2E Edit Debt ${Date.now()}`;
  const editedTitle = `${debtTitle} EDITED`;
  const today = new Date().toISOString().slice(0, 10);

  await loginAsAdmin(page);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();

  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  await page.getByPlaceholder("TÍTULO").fill(debtTitle);
  await page.locator('input[name="amount"]').fill("100.00");
  await fillDate(page, today);
  await page.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Pix" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();

  let debtRow = page.getByRole("button", { name: new RegExp(debtTitle) });
  await expect(debtRow).toBeVisible();

  // --- Edit: change the title and amount ---
  await debtRow.click();
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByPlaceholder("Ex: Supermercado").fill(editedTitle);
  await page.locator('input[name="amount"]').fill("150.00");
  await page.getByRole("button", { name: "Salvar" }).click();

  debtRow = page.getByRole("button", { name: new RegExp(editedTitle) });
  await expect(debtRow).toBeVisible();
  await expect(debtRow).toContainText("R$ 150,00");

  // --- Mark as paid, confirm styling, then delete ---
  await debtRow.click();
  await page.getByRole("button", { name: "Marcar como paga" }).click();
  await expect(debtRow).toHaveClass(/opacity-50/);

  await debtRow.click();
  await expect(page.getByRole("button", { name: "Desfazer" })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await expect(debtRow).not.toBeVisible();

  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
});

test("edit and delete an existing payment", async ({ page }) => {
  const personName = `E2E Payment Edit Person ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  await loginAsAdmin(page);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();

  await page.getByRole("button", { name: "+ Adicionar pagamento" }).click();
  await page.locator('input[name="amount"]').fill("75.00");
  await fillDate(page, today);
  await page.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Dinheiro" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();

  let paymentRow = page.getByRole("button", { name: /R\$ 75,00/ });
  await expect(paymentRow).toBeVisible();

  // --- Edit: change the amount ---
  await paymentRow.click();
  await page.getByRole("button", { name: "Editar" }).click();
  await page.locator('input[name="amount"]').fill("90.00");
  await page.getByRole("button", { name: "Salvar" }).click();

  paymentRow = page.getByRole("button", { name: /R\$ 90,00/ });
  await expect(paymentRow).toBeVisible();

  // --- Delete it ---
  await paymentRow.click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await expect(paymentRow).not.toBeVisible();

  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
});
