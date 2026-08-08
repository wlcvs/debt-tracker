import { test, expect, type Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { generateAccessCode } from "@/lib/access-code";
import { loginAsAdmin } from "./fixtures";

// PublicView (`/public/[code]`) requires no login — `[code]` is the person's
// `accessCode` (a random 12-char string), never their DB id. Seeds data
// directly via Prisma (faster and more deterministic than driving the admin UI
// for multi-month fixtures), matching dismiss-behaviors.spec.ts's beforeAll
// pattern.

const RUN_ID = Date.now();

// balance-summary.tsx is a flat two-column grid, so each label's immediate
// next sibling is its own amount. Resolving it that way is the only reliable
// way to assert on a total that also appears on a debt or payment row further
// down the page (and, unlike the grid container, it can't match the *other*
// row's amount).
const balanceValue = (page: Page, label: string) =>
  page.getByText(label).locator("xpath=following-sibling::*[1]");

const now = new Date();
const currentMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10));
const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10));

let personId: string;
let accessCode: string;
const debtATitle = `E2E Public Debt A ${RUN_ID}`;
const debtBTitle = `E2E Public Debt B Paid ${RUN_ID}`;
const debtCTitle = `E2E Public Debt C Prev Month ${RUN_ID}`;
const paymentXDescription = `E2E Public Payment X ${RUN_ID}`;
const paymentYDescription = `E2E Public Payment Y ${RUN_ID}`;

test.beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow();

  const person = await prisma.person.create({
    data: { userId: user.id, name: `E2E Public View Person ${RUN_ID}`, accessCode: generateAccessCode() },
  });
  personId = person.id;
  accessCode = person.accessCode;

  await prisma.debt.createMany({
    data: [
      { personId, title: debtATitle, description: "", amount: 100, date: currentMonthDate, paid: false, method: "PIX" },
      { personId, title: debtBTitle, description: "", amount: 50, date: currentMonthDate, paid: true, method: "CASH" },
      { personId, title: debtCTitle, description: "", amount: 30, date: prevMonthDate, paid: false, method: "PIX" },
    ],
  });
  await prisma.payment.createMany({
    data: [
      { personId, description: paymentXDescription, amount: 40, date: currentMonthDate, method: "PIX" },
      { personId, description: paymentYDescription, amount: 20, date: prevMonthDate, method: "CASH" },
    ],
  });
  // All-time: totalOwed = 100 + 30 (unpaid debts only, payments never
  // subtracted) = 130; totalPaid = 40 + 20 = 60.
  // The summary under the carousel, though, only ever reports the selected
  // month — see the assertions below.
});

test.afterAll(async () => {
  await prisma.payment.deleteMany({ where: { personId } });
  await prisma.debt.deleteMany({ where: { personId } });
  await prisma.person.delete({ where: { id: personId } });
});

test("public view: renders without login, filters by month, read-only modals, filters, and installment calculator", async ({ page }) => {
  // No loginAsAdmin() call — this is the whole point of the public route.
  await page.goto(`/public/${accessCode}`);
  await expect(page).toHaveURL(`/public/${accessCode}`);
  await expect(page.getByRole("heading", { name: `E2E Public View Person ${RUN_ID}` })).toBeVisible();
  // Labelled balance block under the carousel — no progress bar, and never a
  // negative total. Scoped to the month the carousel opens on (the current
  // one): debt A is the only unpaid debt in it (B is paid, C is last month),
  // and payment X is its only payment.
  await expect(balanceValue(page, "Valor devido")).toHaveText("R$ 100,00");
  await expect(balanceValue(page, "Valor pago")).toHaveText("R$ 40,00");

  // --- Month carousel: current month shows A and B, not C ---
  const debtARow = page.getByRole("button", { name: new RegExp(debtATitle) });
  const debtBRow = page.getByRole("button", { name: new RegExp(debtBTitle) });
  const debtCRow = page.getByRole("button", { name: new RegExp(debtCTitle) });
  await expect(debtARow).toBeVisible();
  await expect(debtBRow).toBeVisible();
  await expect(debtCRow).not.toBeVisible();

  // Switch to the previous month tab: now C (and payment Y) show, A/B don't.
  await page.getByRole("button", { name: /^[A-Za-zç]{3} de \d{2}$/ }).first().click();
  await expect(debtCRow).toBeVisible();
  await expect(debtARow).not.toBeVisible();
  await expect(page.getByText(paymentYDescription)).toBeVisible();

  // The balance summary follows the carousel too — it used to stay on the
  // all-time totals while the lists below it moved.
  await expect(balanceValue(page, "Valor devido")).toHaveText("R$ 30,00");
  await expect(balanceValue(page, "Valor pago")).toHaveText("R$ 20,00");

  // Back to current month for the rest of the test.
  await page.getByRole("button", { name: /^[A-Za-zç]{3} de \d{2}$/ }).last().click();
  await expect(debtARow).toBeVisible();

  // --- Read-only debt modal: no Editar/Excluir/paid-toggle, shows "Paga" for B ---
  await debtBRow.click();
  await expect(page.getByText("Dívida", { exact: true })).toBeVisible();
  await expect(page.getByText("Paga", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Excluir", exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Marcar como paga|Desfazer/ })).not.toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // --- Read-only payment modal ---
  await page.getByText(paymentXDescription).click();
  await expect(page.getByText("Pagamento", { exact: true })).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: "R$ 40,00" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar" })).not.toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // --- Debts filter toolbar: search narrows the list ---
  await page.getByText("Dívidas", { exact: true }).locator("xpath=..").getByRole("button", { name: "Filtros" }).click();
  await page.getByPlaceholder("Pesquisar dívidas...").fill(debtATitle);
  await expect(debtARow).toBeVisible();
  await expect(debtBRow).not.toBeVisible();
  await page.getByRole("button", { name: "Limpar" }).click();
  await expect(debtBRow).toBeVisible();

  // --- Installment calculator: presets and +/- stepper ---
  // Deliberately on the all-time owed total (130), not the month's: it
  // simulates paying off the whole balance.
  const monthsInput = page.getByLabel("Aumentar meses").locator("xpath=preceding-sibling::input");
  // ToggleGroup type="single" renders role="radio" inside a role="radiogroup",
  // not plain buttons.
  await page.getByRole("radio", { name: "6x" }).click();
  await expect(monthsInput).toHaveValue("6");
  await expect(page.getByText("R$ 21,67")).toBeVisible(); // 130 / 6

  await page.getByRole("button", { name: "Aumentar meses" }).click();
  await expect(monthsInput).toHaveValue("7");
  await page.getByRole("button", { name: "Diminuir meses" }).click();
  await page.getByRole("button", { name: "Diminuir meses" }).click();
  await expect(monthsInput).toHaveValue("5");
  await expect(page.getByText("R$ 26,00")).toBeVisible(); // 130 / 5
});

test("public view: 404s when the person's public page is hidden", async ({ page }) => {
  const user = await prisma.user.findFirstOrThrow();
  const hiddenPersonName = `E2E Hidden Person ${RUN_ID}`;
  const hiddenPerson = await prisma.person.create({
    data: { userId: user.id, name: hiddenPersonName, publicVisible: false, accessCode: generateAccessCode() },
  });

  // Asserting on rendered content, not response.status(): with loading.tsx
  // present on this route, Next streams the initial 200 before notFound()
  // resolves, so the HTTP status can't become 404 — see the note in
  // src/app/public/[code]/page.tsx. The content itself is still correct
  // (default Next not-found page, no debtor data), which is what matters
  // for not leaking whether a hidden person's id exists.
  await page.goto(`/public/${hiddenPerson.accessCode}`);
  await expect(page.getByText("This page could not be found")).toBeVisible();
  await expect(page.getByText(hiddenPersonName)).not.toBeVisible();

  await prisma.person.delete({ where: { id: hiddenPerson.id } });
});

test("dashboard: toggling public visibility blocks and restores the public page", async ({ page, context }) => {
  const user = await prisma.user.findFirstOrThrow();
  const person = await prisma.person.create({
    data: { userId: user.id, name: `E2E Toggle Visibility Person ${RUN_ID}`, accessCode: generateAccessCode() },
  });

  await loginAsAdmin(page);
  await page.goto(`/person/${person.accessCode}`);

  const toggleButton = page.getByRole("button", { name: /PÁGINA PÚBLICA/ });
  await expect(toggleButton).toHaveText("OCULTAR PÁGINA PÚBLICA");

  await toggleButton.click();
  await expect(toggleButton).toHaveText("REATIVAR PÁGINA PÚBLICA");

  // See the sibling "404s when hidden" test above for why this asserts on
  // content, not response.status().
  const hiddenPage = await context.newPage();
  await hiddenPage.goto(`/public/${person.accessCode}`);
  await expect(hiddenPage.getByText("This page could not be found")).toBeVisible();
  await hiddenPage.close();

  await toggleButton.click();
  await expect(toggleButton).toHaveText("OCULTAR PÁGINA PÚBLICA");

  const visiblePage = await context.newPage();
  await visiblePage.goto(`/public/${person.accessCode}`);
  await expect(visiblePage.getByRole("heading", { name: `E2E Toggle Visibility Person ${RUN_ID}` })).toBeVisible();
  await visiblePage.close();

  await prisma.person.delete({ where: { id: person.id } });
});
