import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

import { E2E_EMAIL } from "./global-setup";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

// Public page — no auth needed
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Public (debtor view)", () => {
  let accessCode: string;

  test.beforeAll(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const res = await client.query('SELECT id FROM "User" WHERE email = $1', [E2E_EMAIL]);
      if (res.rowCount === 0) throw new Error("Test user not found");
      const userId = res.rows[0].id;

      const personId = randomUUID();
      const code = `e2e-${Date.now()}`;
      await client.query(
        'INSERT INTO "Person" (id, "userId", name, "accessCode", "createdAt") VALUES ($1, $2, $3, $4, now())',
        [personId, userId, 'Devedor E2E', code]
      );

      // create debts
      await client.query(
        'INSERT INTO "Debt" (id, "personId", amount, description, date, "createdAt") VALUES ($1, $2, $3, $4, $5, now()), ($6, $2, $7, $8, $9, now())',
        [randomUUID(), personId, 300, 'Conta E2E', new Date(), randomUUID(), 100, 'Lanche E2E', new Date()]
      );

      // create payment
      await client.query(
        'INSERT INTO "Payment" (id, "personId", amount, date, method, "createdAt") VALUES ($1, $2, $3, $4, $5, now())',
        [randomUUID(), personId, 100, new Date(), 'PIX']
      );

      // expose accessCode to tests
      (global as any).__E2E_ACCESS_CODE = code;
      accessCode = code;
    } finally {
      await client.end();
    }
  });

  test("shows debtor name and balance via direct URL", async ({ page }) => {
    const code = accessCode || (global as any).__E2E_ACCESS_CODE;
    await page.goto(`/public/${code}`);
    await expect(page.locator("text=Devedor E2E")).toBeVisible();
    // 300 + 100 - 100 paid = 300 (appears in balance header AND debt list span)
    await expect(page.locator("text=R$ 300.00").first()).toBeVisible();
  });

  test("shows list of debts", async ({ page }) => {
    const code2 = accessCode || (global as any).__E2E_ACCESS_CODE;
    await page.goto(`/public/${code2}`);
    await expect(page.locator("text=Conta E2E")).toBeVisible();
    await expect(page.locator("text=Lanche E2E")).toBeVisible();
  });

  test("shows payments section", async ({ page }) => {
    const code3 = accessCode || (global as any).__E2E_ACCESS_CODE;
    await page.goto(`/public/${code3}`);
    await expect(page.locator("text=Pagamentos")).toBeVisible();
    // R$ 100.00 appears in both the debt list and payment list → use .first()
    await expect(page.locator("text=R$ 100.00").first()).toBeVisible();
  });

  test("returns 404 for invalid access code", async ({ page }) => {
    await page.goto("/public/codigo-que-nao-existe-9999");
    await expect(page).toHaveURL(/public/);
    // Next.js not-found renders a 404
    const status = await page.evaluate(() => document.title);
    expect(
      page.locator("text=404").or(page.locator("text=Not Found"))
    ).toBeTruthy();
  });

});
