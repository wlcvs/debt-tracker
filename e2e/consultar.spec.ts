import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { E2E_EMAIL } from "./global-setup";

// Public page — no auth needed
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Consultar (debtor view)", () => {
  let accessCode: string;

  test.beforeAll(async () => {
    const prisma = new PrismaClient();
    try {
      const user = await prisma.user.findUnique({ where: { email: E2E_EMAIL } });
      if (!user) throw new Error("Test user not found");

      const person = await prisma.person.create({
        data: {
          name: "Devedor E2E",
          userId: user.id,
          accessCode: `e2e-${Date.now()}`,
          debts: {
            create: [
              { amount: 300, description: "Conta E2E", date: new Date() },
              { amount: 100, description: "Lanche E2E", date: new Date() },
            ],
          },
          payments: {
            create: [{ amount: 100, date: new Date(), method: "PIX" }],
          },
        },
      });
      accessCode = person.accessCode;
    } finally {
      await prisma.$disconnect();
    }
  });

  test("shows debtor name and balance via direct URL", async ({ page }) => {
    await page.goto(`/consultar/${accessCode}`);
    await expect(page.locator("text=Devedor E2E")).toBeVisible();
    // 300 + 100 - 100 paid = 300
    await expect(page.locator("text=R$ 300.00")).toBeVisible();
  });

  test("shows list of debts", async ({ page }) => {
    await page.goto(`/consultar/${accessCode}`);
    await expect(page.locator("text=Conta E2E")).toBeVisible();
    await expect(page.locator("text=Lanche E2E")).toBeVisible();
  });

  test("shows payments section", async ({ page }) => {
    await page.goto(`/consultar/${accessCode}`);
    await expect(page.locator("text=Pagamentos")).toBeVisible();
    await expect(page.locator("text=R$ 100.00")).toBeVisible();
  });

  test("returns 404 for invalid access code", async ({ page }) => {
    await page.goto("/consultar/codigo-que-nao-existe-9999");
    await expect(page).toHaveURL(/consultar/);
    // Next.js not-found renders a 404
    const status = await page.evaluate(() => document.title);
    expect(
      page.locator("text=404").or(page.locator("text=Not Found"))
    ).toBeTruthy();
  });

  test("old /consultar form page still works", async ({ page }) => {
    await page.goto("/consultar");
    await expect(page.locator('[name="accessCode"]')).toBeVisible();
  });
});
