import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { loginAsAdmin } from "./fixtures";

// Regression coverage for the nested-dismissable bug class documented in
// src/lib/hooks/use-dismiss.ts: clicking outside an inline edit (nested
// inside a modal) must cancel/commit only that edit, not close the whole
// parent modal. Browser event order (mousedown -> blur -> mouseup -> click)
// means the inline edit's onBlur always fires and resets its own state
// before the outer click handler runs, so this can only be exercised
// reliably through a real browser click sequence — not a unit test.

const RUN_ID = Date.now();

let renameStatementId: string;
let renameFilename: string;
let importStatementId: string;
let importDescription: string;

test.beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow();

  renameFilename = `E2E Rename Test ${RUN_ID}.pdf`;
  const renameStmt = await prisma.statement.create({
    data: {
      userId: user.id,
      bank: "Nubank",
      filename: renameFilename,
      pdfData: Buffer.from("%PDF-1.4\n%%EOF"),
      transactionCount: 0,
      algoResults: [],
      LLMResults: [],
      extractedText: "e2e seed",
    },
  });
  renameStatementId = renameStmt.id;

  importDescription = `E2E Original Description ${RUN_ID}`;
  const txn = { date: "2026-01-15", description: importDescription, amount: 42.5 };
  const importStmt = await prisma.statement.create({
    data: {
      userId: user.id,
      bank: "Nubank",
      filename: `E2E Import Test ${RUN_ID}.pdf`,
      pdfData: Buffer.from("%PDF-1.4\n%%EOF"),
      transactionCount: 1,
      algoResults: [txn],
      // Non-empty LLMResults + extractedText so reopenStatement() takes the
      // cached branch and never touches the LLM server or re-parses the PDF.
      LLMResults: [txn],
      extractedText: "e2e seed",
    },
  });
  importStatementId = importStmt.id;
});

test.afterAll(async () => {
  await prisma.statement.deleteMany({ where: { id: { in: [renameStatementId, importStatementId] } } });
});

test("statements-modal: outside click cancels the rename, not the whole modal", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Extratos" }).click();
  await expect(page.getByText("Extratos salvos")).toBeVisible();

  // Anchored on "Fechar" (always present while the modal is open) rather than
  // the filename button, which is replaced by an input the moment "Renomear"
  // is clicked — a locator chained through it would stop resolving right
  // when we need it most.
  const panel = page.getByRole("button", { name: "Fechar" }).locator("xpath=../..");
  const filenameBtn = panel.getByRole("button", { name: renameFilename, exact: true });
  await filenameBtn.locator("xpath=..").getByRole("button", { name: "Renomear" }).click();

  const input = panel.locator('input[type="text"]');
  const renamed = `${renameFilename} EDITED`;
  await input.fill(renamed);

  // First outside click: commits the rename (blur already fired) but must
  // only end the edit — the modal itself has to stay open.
  await page.mouse.click(5, 5);
  await expect(page.getByText("Extratos salvos")).toBeVisible();
  await expect(page.getByRole("button", { name: renamed, exact: true })).toBeVisible();

  // Second outside click, with no edit in progress: now it closes the modal.
  await page.mouse.click(5, 5);
  await expect(page.getByText("Extratos salvos")).not.toBeVisible();
});

test("import-modal: outside click cancels the description edit, not the whole modal", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Extratos" }).click();
  await expect(page.getByText("Extratos salvos")).toBeVisible();

  const importFilenameBtn = page.getByRole("button", { name: `E2E Import Test ${RUN_ID}.pdf`, exact: true });
  const importRow = importFilenameBtn.locator("xpath=..");
  await importRow.getByRole("button", { name: "Abrir" }).click();

  const descSpan = page.getByText(importDescription, { exact: true });
  await expect(descSpan).toBeVisible();
  await descSpan.click();

  const descInput = page.locator('table input[type="text"]');
  await expect(descInput).toHaveValue(importDescription);
  const editedDescription = `${importDescription} EDITED`;
  await descInput.fill(editedDescription);

  // First outside click (backdrop margin exposed by the review step's
  // lg:p-6 padding): commits the description edit but must only end the
  // edit — the import modal has to stay open.
  await page.mouse.click(5, 5);
  await expect(page.getByText("Importar extrato")).toBeVisible();
  await expect(page.getByText(editedDescription, { exact: true })).toBeVisible();

  // Second outside click, with no edit in progress: now it closes the
  // import modal (and returns to the statements list, since it was opened
  // via "Abrir").
  await page.mouse.click(5, 5);
  await expect(page.getByText("Importar extrato")).not.toBeVisible();
});
