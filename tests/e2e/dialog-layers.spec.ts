import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

// Coverage for the two things the Radix Dialog migration changed about
// layering, both on a deliberately low-stakes modal (debt-detail-modal).
//
// Test 1 de-risks the whole migration: every outside-click assertion in
// dismiss-behaviors.spec.ts uses page.mouse.click(), and Radix detects
// outside-clicks via `pointerdown` where the old useDismiss used `click`.
// If Playwright's synthetic mouse didn't produce a pointerdown Radix sees,
// those four tests would all go red at once in a later phase, mixing a
// migration bug up with a test-harness question. Proving it here first
// keeps those two failures distinguishable.
//
// Test 2 locks a bug the migration fixes: ConfirmDialog used to attach its
// own window-level Escape listener while ModalShell attached another, so one
// Escape press closed the confirmation *and* the detail modal underneath it.
// Radix arms only the topmost layer, so Escape now unwinds one at a time.

async function createPersonWithDebt(page: import("@playwright/test").Page, personName: string, debtTitle: string) {
  const today = new Date().toISOString().slice(0, 10);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();

  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  await page.getByPlaceholder("TÍTULO").fill(debtTitle);
  await page.locator('input[name="amount"]').fill("100.00");
  await page.locator('input[name="date"]').fill(today);
  await page.getByRole("button", { name: "— Método —" }).click();
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Salvar" }).click();

  const debtRow = page.getByRole("button", { name: new RegExp(debtTitle) });
  await expect(debtRow).toBeVisible();
  return debtRow;
}

async function deletePerson(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
}

test("backdrop click closes the debt detail modal", async ({ page }) => {
  const runId = Date.now();
  await loginAsAdmin(page);
  const debtRow = await createPersonWithDebt(page, `E2E Backdrop Person ${runId}`, `E2E Backdrop Debt ${runId}`);

  await debtRow.click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();

  // The backdrop's p-4 ring is the only "outside" region — Dialog.Content is
  // nested inside Dialog.Overlay precisely so this area exists.
  await page.mouse.click(5, 5);
  await expect(modal).not.toBeVisible();

  await deletePerson(page);
});

test("Escape on the delete confirmation closes only the confirmation", async ({ page }) => {
  const runId = Date.now();
  await loginAsAdmin(page);
  const debtRow = await createPersonWithDebt(page, `E2E Confirm Person ${runId}`, `E2E Confirm Debt ${runId}`);

  await debtRow.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();

  // First Escape: unwinds only the topmost layer. The detail modal behind it
  // must stay open, and the debt must NOT have been deleted.
  await page.keyboard.press("Escape");
  await expect(confirm).not.toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Second Escape: now the detail modal itself closes.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(debtRow).toBeVisible();

  await deletePerson(page);
});
