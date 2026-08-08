import { test, expect } from "@playwright/test";
import { loginAsAdmin, fillDate } from "./fixtures";

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
  await fillDate(page, today);
  await page.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Pix" }).click();
  await page.getByRole("checkbox", { name: "Parcelar" }).check();
  // Set explicitly rather than leaning on whatever the field defaults to: every
  // assertion below is about a two-installment group, so the count is part of
  // this test's setup, not an incidental default it should break with.
  await page.getByRole("textbox", { name: "Número de parcelas" }).fill("2");
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

  // --- A grouped debt offers "Editar compra" and "Ver parcelas", never a
  // plain "Editar": one installment can't be edited on its own. exact:true
  // matters — getByRole's name matches by substring, so a bare "Editar"
  // would be satisfied by the "Editar compra" button sitting right next to it.
  await debtRow1.click();
  await expect(page.getByText("Dívida", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar", exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Editar compra" })).toBeVisible();
  await page.getByRole("button", { name: "Ver parcelas" }).click();

  // --- InstallmentGroupPanel: select unpaid, register a single payment, mark paid ---
  await expect(page.getByText(`Parcelas — ${debtTitle}`)).toBeVisible();
  await page.getByRole("button", { name: "Selecionar não pagas" }).click();
  await page.getByRole("checkbox", { name: "Registrar pagamento correspondente" }).check();
  await fillDate(page.getByRole("group", { name: "Data do pagamento" }), today);
  await page.getByRole("button", { name: "Marcar selecionadas como pagas" }).click();

  // Both installment rows should now show as paid (strikethrough amount, no "Marcar paga" button left).
  await expect(page.getByRole("button", { name: "Marcar paga" })).toHaveCount(0);

  // Two ModalShells are stacked here (the panel on top of the debt modal),
  // each with its own "Fechar" — close the panel (rendered last, on top) first.
  await page.getByRole("button", { name: "Fechar" }).last().click();
  await page.getByRole("button", { name: "Fechar" }).click();

  // A single lump-sum Payment for the full 200.00 should now exist. Scoped to
  // the payment row — the header's "Valor pago" line shows R$ 200,00 too.
  await expect(page.getByRole("button", { name: /R\$ 200,00/ })).toBeVisible();

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

test("edit a parceled purchase as a unit: title, total, count and first date", async ({ page }) => {
  const personName = `E2E Group Edit Person ${Date.now()}`;
  const debtTitle = `E2E Group Edit Debt ${Date.now()}`;
  const newTitle = `${debtTitle} Renamed`;
  // Anchored to the 1st of the month so growing the group can't run into a
  // day-of-month clamp and shift a date the assertions below expect.
  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  await loginAsAdmin(page);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();

  // --- Create a 2x purchase of 200,00 ---
  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  await page.getByPlaceholder("TÍTULO").fill(debtTitle);
  await page.locator('input[name="amount"]').fill("200,00");
  await fillDate(page, firstOfMonth);
  await page.getByRole("combobox", { name: "Método" }).click();
  await page.getByRole("option", { name: "Pix" }).click();
  await page.getByRole("checkbox", { name: "Parcelar" }).check();
  await page.getByRole("textbox", { name: "Número de parcelas" }).fill("2");
  await page.getByRole("button", { name: "Salvar" }).click();

  const row = (title: string, badge: string) =>
    page.getByRole("button", { name: new RegExp(`${title}.*${badge}`) });
  await expect(row(debtTitle, "1/2")).toBeVisible();

  // --- Mark installment 1 paid, so the edit can be checked against it ---
  await row(debtTitle, "1/2").click();
  await page.getByRole("button", { name: "Ver parcelas" }).click();
  await page.getByRole("button", { name: "Marcar paga" }).first().click();
  await expect(page.getByRole("button", { name: "Marcar paga" })).toHaveCount(1);

  // The list is for ticking installments off, nothing else: the only way to
  // the purchase form is the debt modal's button, used below.
  await expect(page.getByRole("button", { name: "Editar compra" })).toHaveCount(0);

  // Close only the panel (rendered last, on top), leaving the debt modal open.
  await page.getByRole("button", { name: "Fechar" }).last().click();

  // --- Edit the whole purchase from the modal's own shortcut, which skips
  // the installment list entirely. Rename, 200,00 in 2x -> 300,00 in 3x.
  await page.getByRole("button", { name: "Editar compra" }).click();
  await expect(page.getByText(`Editar compra — ${debtTitle}`)).toBeVisible();
  // Straight into the form — no installment list in between.
  await expect(page.getByRole("button", { name: "Selecionar não pagas" })).not.toBeVisible();

  // Prefilled from the group as it stands.
  await expect(page.getByRole("textbox", { name: "Valor total" })).toHaveValue("200,00");
  await expect(page.getByRole("textbox", { name: "Número de parcelas" })).toHaveValue("2");

  await page.getByPlaceholder("Ex: Supermercado").fill(newTitle);
  await page.getByRole("textbox", { name: "Valor total" }).fill("300,00");
  await page.getByRole("textbox", { name: "Número de parcelas" }).fill("3");

  // The preview shows what will be written, from the same helper the action uses.
  await expect(page.getByText("1/3 —")).toBeVisible();
  await expect(page.getByText("3/3 —")).toBeVisible();

  await page.getByRole("button", { name: "Salvar" }).click();

  // Saving closes the panel and the debt modal behind it — the single
  // installment that modal was showing no longer exists as it was.
  await expect(page.getByText("Dívida", { exact: true })).not.toBeVisible();

  // --- The group is rewritten: new title, 3 rows, 100,00 each ---
  await expect(row(newTitle, "1/3")).toBeVisible();
  await expect(row(debtTitle, "1/2")).not.toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`${newTitle}.*1/3.*R\\$ 100,00`) })).toBeVisible();

  // Installment 1 was paid before the edit and stays paid after it.
  await expect(row(newTitle, "1/3")).toHaveClass(/opacity-50/);

  // The third installment is two months out — a month tab that didn't exist
  // before the edit, so its presence is what proves the group actually grew.
  await expect(page.getByRole("button", { name: /^[A-Za-zç]{3} de \d{2}$/ })).toHaveCount(3);
  await page.getByRole("button", { name: /^[A-Za-zç]{3} de \d{2}$/ }).nth(2).click();
  await expect(row(newTitle, "3/3")).toBeVisible();

  // Clean up the scratch person.
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: personName })).not.toBeVisible();
});
