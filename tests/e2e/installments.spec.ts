import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

test("create a parceled debt, bulk-mark installments paid with a payment, then delete the group", async ({ page }) => {
  const personName = `E2E Installments Person ${Date.now()}`;
  const debtTitle = `E2E Installment Debt ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  await loginAsAdmin(page);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();
  await expect(page.getByRole("heading", { name: personName })).toBeVisible();

  // --- Create a 2-installment debt ---
  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  await page.getByPlaceholder("TÍTULO").fill(debtTitle);
  await page.locator('input[name="amount"]').fill("200.00");
  await page.locator('input[name="date"]').fill(today);
  await page.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Pix" }).click();
  await page.getByRole("checkbox", { name: "Parcelar" }).check();
  // installments defaults to 2 — leave as-is.
  await page.getByRole("button", { name: "Salvar" }).click();

  // Installment 1 falls in the current month (visible under the month
  // carousel's default selection); installment 2, one month forward, only
  // shows up after switching to next month's tab — confirm both render with
  // a "i/2" badge next to the title before switching back to keep working
  // through installment 1's modal (group actions apply to the whole group
  // regardless of which installment's row you open them from).
  const debtRow1 = page.getByRole("button", { name: new RegExp(`${debtTitle}.*1/2`) });
  const debtRow2 = page.getByRole("button", { name: new RegExp(`${debtTitle}.*2/2`) });
  await expect(debtRow1).toBeVisible();

  const nextMonthTab = page.getByRole("button", { name: /^[A-Za-zç]{3} de \d{2}$/ }).nth(1);
  await nextMonthTab.click();
  await expect(debtRow2).toBeVisible();
  await page.getByRole("button", { name: /^[A-Za-zç]{3} de \d{2}$/ }).nth(0).click();
  await expect(debtRow1).toBeVisible();

  // --- Grouped debts hide "Editar" and offer "Ver parcelas" instead ---
  await debtRow1.click();
  await expect(page.getByText("Dívida", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).not.toBeVisible();
  await page.getByRole("button", { name: "Ver parcelas" }).click();

  // --- InstallmentGroupPanel: select unpaid, register a single payment, mark paid ---
  await expect(page.getByText(`Parcelas — ${debtTitle}`)).toBeVisible();
  await page.getByRole("button", { name: "Selecionar não pagas" }).click();
  await page.getByRole("checkbox", { name: "Registrar pagamento correspondente" }).check();
  await page.locator('input[type="date"]').last().fill(today);
  await page.getByRole("button", { name: "Marcar selecionadas como pagas" }).click();

  // Both installment rows should now show as paid (strikethrough amount, no "Marcar paga" button left).
  await expect(page.getByRole("button", { name: "Marcar paga" })).toHaveCount(0);

  // Two ModalShells are stacked here (the panel on top of the debt modal),
  // each with its own "Fechar" — close the panel (rendered last, on top) first.
  await page.getByRole("button", { name: "Fechar" }).last().click();
  await page.getByRole("button", { name: "Fechar" }).click();

  // A single lump-sum Payment for the full 200.00 should now exist.
  await expect(page.getByText("R$ 200.00")).toBeVisible();

  // Installment 1 (current month, in view) should render as paid (opacity-50).
  await expect(debtRow1).toHaveClass(/opacity-50/);

  // --- Delete the whole group at once ---
  await debtRow1.click();
  await expect(page.getByText("Dívida", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText(`Todas as 2 parcelas`)).toBeVisible();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await expect(debtRow1).not.toBeVisible();
  // The other month's tab disappears entirely once its only debt is gone
  // (month-carousel.tsx only ever shows months that actually have data,
  // plus the current one) — confirming the whole group, not just
  // installment 1, was deleted.
  await expect(page.getByRole("button", { name: /^[A-Za-zç]{3} de \d{2}$/ })).toHaveCount(1);

  // Clean up the scratch person.
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: personName })).not.toBeVisible();
});
