import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { loginAsAdmin } from "./fixtures";

// Exercises the statement-import review screen (FilterToolbar + sort +
// ManualAddDialog) without ever hitting the LLM server: the seeded
// Statement has non-empty LLMResults/extractedText, so reopenStatement()
// takes its cached branch (same trick as dismiss-behaviors.spec.ts).

const RUN_ID = Date.now();

const filename = `E2E Import Review Test ${RUN_ID}.pdf`;
const txns = [
  { date: "2026-01-05", description: `E2E Import Txn Alpha ${RUN_ID}`, amount: 12.34 },
  { date: "2026-01-10", description: `E2E Import Txn Beta ${RUN_ID}`, amount: 56.78 },
  { date: "2026-01-15", description: `E2E Import Txn Gamma ${RUN_ID}`, amount: 99.0 },
];
const manualTitle = `E2E Manual Txn ${RUN_ID}`;

let statementId: string;

test.beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow();
  const stmt = await prisma.statement.create({
    data: {
      userId: user.id,
      bank: "Nubank",
      filename,
      pdfData: Buffer.from("%PDF-1.4\n%%EOF"),
      transactionCount: txns.length,
      algoResults: txns,
      LLMResults: txns,
      extractedText: "e2e seed",
    },
  });
  statementId = stmt.id;
});

test.afterAll(async () => {
  await prisma.statement.delete({ where: { id: statementId } });
  await prisma.lLMFeedback.deleteMany({ where: { bank: "Nubank", description: manualTitle } });
});

test("statement import review: filter, sort, and manually add a transaction", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Extratos" }).click();
  await expect(page.getByText("Extratos salvos")).toBeVisible();

  const row = page.getByRole("button", { name: filename, exact: true }).locator("xpath=..");
  await row.getByRole("button", { name: "Abrir" }).click();

  await expect(page.getByText("Importar extrato")).toBeVisible();
  // "Nubank" isn't unique page-wide (Chrome's own autofill suggestions can
  // surface unrelated matches) — scope to the modal header, which is the
  // only place this app itself renders the detected bank name.
  await expect(page.getByText("Importar extrato").locator("xpath=..").getByText("Nubank", { exact: true })).toBeVisible();
  await expect(page.getByText("3 transações extraídas do PDF")).toBeVisible();
  for (const t of txns) await expect(page.getByText(t.description, { exact: true })).toBeVisible();

  // --- Filter toolbar: search narrows to one row ---
  await page.getByRole("button", { name: "Filtros" }).click();
  await page.getByPlaceholder("Descrição…").fill("Beta");
  await expect(page.getByText(txns[1].description, { exact: true })).toBeVisible();
  await expect(page.getByText(txns[0].description, { exact: true })).not.toBeVisible();
  await expect(page.getByText(txns[2].description, { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Limpar" }).click();
  for (const t of txns) await expect(page.getByText(t.description, { exact: true })).toBeVisible();

  // --- Sort by amount: first click sorts descending (Gamma, Beta, Alpha) ---
  await page.getByRole("button", { name: "Valor", exact: true }).click();
  const descriptionCells = page.locator("tbody tr td:nth-child(2) span").first().locator("xpath=/ancestor::tbody").locator("tr td:nth-child(2) span");
  await expect(descriptionCells.nth(0)).toHaveText(txns[2].description);
  await expect(descriptionCells.nth(1)).toHaveText(txns[1].description);
  await expect(descriptionCells.nth(2)).toHaveText(txns[0].description);

  // --- Manually add a transaction ---
  await page.getByRole("button", { name: "+ Adicionar manualmente" }).click();
  await expect(page.getByText("Adicionar transação manualmente")).toBeVisible();
  const manualDialog = page.locator("form").filter({ hasText: "DataValor (R$)TítuloDescrição" });
  await manualDialog.locator('input[type="date"]').fill("2026-01-20");
  await manualDialog.locator('input[type="number"]').fill("10.00");
  // The dialog's labels aren't wired via htmlFor (see manual-add-dialog.tsx) —
  // getByLabel can't resolve them, so target the required text input (Título)
  // positionally; it's the only required text field, "Descrição" isn't.
  await manualDialog.locator('input[type="text"]').first().fill(manualTitle);
  // Método is required (manual-add-dialog.tsx's confirmManualAdd bails out and
  // flags the field when it's empty). Scoped to the dialog because the review
  // table behind it has a method select of its own on every row.
  await manualDialog.getByRole("button", { name: "— Método —" }).click();
  await manualDialog.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();

  await expect(page.getByText(manualTitle, { exact: true })).toBeVisible();
  await expect(page.getByText("4 transações extraídas do PDF")).toBeVisible();

  // Close without saving — no person exists to attribute these to.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("Importar extrato")).not.toBeVisible();
});
