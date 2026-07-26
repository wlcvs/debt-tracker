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
let escapeRenameStatementId: string;
let escapeRenameFilename: string;
let escapeImportStatementId: string;
let escapeImportDescription: string;

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

  escapeRenameFilename = `E2E Escape Rename Test ${RUN_ID}.pdf`;
  const escapeRenameStmt = await prisma.statement.create({
    data: {
      userId: user.id,
      bank: "Nubank",
      filename: escapeRenameFilename,
      pdfData: Buffer.from("%PDF-1.4\n%%EOF"),
      transactionCount: 0,
      algoResults: [],
      LLMResults: [],
      extractedText: "e2e seed",
    },
  });
  escapeRenameStatementId = escapeRenameStmt.id;

  escapeImportDescription = `E2E Escape Description ${RUN_ID}`;
  const escapeTxn = { date: "2026-01-15", description: escapeImportDescription, amount: 17.25 };
  const escapeImportStmt = await prisma.statement.create({
    data: {
      userId: user.id,
      bank: "Nubank",
      filename: `E2E Escape Import Test ${RUN_ID}.pdf`,
      pdfData: Buffer.from("%PDF-1.4\n%%EOF"),
      transactionCount: 1,
      algoResults: [escapeTxn],
      LLMResults: [escapeTxn],
      extractedText: "e2e seed",
    },
  });
  escapeImportStatementId = escapeImportStmt.id;
});

test.afterAll(async () => {
  await prisma.statement.deleteMany({
    where: { id: { in: [renameStatementId, importStatementId, escapeRenameStatementId, escapeImportStatementId] } },
  });
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

// Escape triggers the SAME nested-dismissable bug class as outside-click, but
// through a third, independent mechanism (see useDismissGuard's doc comment
// in use-dismiss.ts): React flushes the inline edit's own Escape-triggered
// state update synchronously, before the same native keydown event reaches
// the modal-level Escape listener — so without suppressNext() in the inline
// edit's own Escape handler (not just its onBlur), the outer handler sees
// the inline edit already "inactive" and closes the whole modal. This bug
// was found via manual QA after the import-modal.tsx breakup (Phase D) and
// turned out to predate that refactor — it was already on main.

test("statements-modal: Escape cancels the rename, not the whole modal", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Extratos" }).click();
  await expect(page.getByText("Extratos salvos")).toBeVisible();

  const panel = page.getByRole("button", { name: "Fechar" }).locator("xpath=../..");
  const filenameBtn = panel.getByRole("button", { name: escapeRenameFilename, exact: true });
  await filenameBtn.locator("xpath=..").getByRole("button", { name: "Renomear" }).click();

  const input = panel.locator('input[type="text"]');
  await input.fill(`${escapeRenameFilename} SHOULD NOT SAVE`);

  // First Escape: cancels the rename (input's own onKeyDown), discarding the
  // typed text — but the modal itself must stay open.
  await page.keyboard.press("Escape");
  await expect(page.getByText("Extratos salvos")).toBeVisible();
  await expect(panel.getByRole("button", { name: escapeRenameFilename, exact: true })).toBeVisible();

  // Second Escape, with no edit in progress: now it closes the modal.
  await page.keyboard.press("Escape");
  await expect(page.getByText("Extratos salvos")).not.toBeVisible();
});

test("import-modal: Escape cancels the description edit, not the whole modal", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Extratos" }).click();
  await expect(page.getByText("Extratos salvos")).toBeVisible();

  const importFilenameBtn = page.getByRole("button", { name: `E2E Escape Import Test ${RUN_ID}.pdf`, exact: true });
  const importRow = importFilenameBtn.locator("xpath=..");
  await importRow.getByRole("button", { name: "Abrir" }).click();

  const descSpan = page.getByText(escapeImportDescription, { exact: true });
  await expect(descSpan).toBeVisible();
  await descSpan.click();

  const descInput = page.locator('table input[type="text"]');
  await expect(descInput).toHaveValue(escapeImportDescription);
  await descInput.fill(`${escapeImportDescription} SHOULD NOT SAVE`);

  // First Escape: cancels the description edit, discarding the typed text —
  // but the import modal itself must stay open.
  await page.keyboard.press("Escape");
  await expect(page.getByText("Importar extrato")).toBeVisible();
  await expect(page.getByText(escapeImportDescription, { exact: true })).toBeVisible();

  // Second Escape, with no edit in progress: now it closes the import modal.
  await page.keyboard.press("Escape");
  await expect(page.getByText("Importar extrato")).not.toBeVisible();
});
