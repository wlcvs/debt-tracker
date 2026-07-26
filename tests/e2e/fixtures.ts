import type { Page } from "@playwright/test";

/**
 * Drives the real login-form.tsx / signInAction flow (not smoke.sh's curl
 * trick, which exists only because curl can't fill a form) so the E2E suite
 * exercises the same path a real admin does.
 */
export async function loginAsAdmin(page: Page) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL/ADMIN_PASSWORD must be set (see .env) to run the E2E suite."
    );
  }

  await page.goto("/login");
  await page.getByPlaceholder("E-MAIL").fill(email);
  await page.getByPlaceholder("SENHA").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}
