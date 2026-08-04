import type { Locator, Page } from "@playwright/test";

/**
 * Fills a `DateField` (src/components/date-field.tsx) with a YYYY-MM-DD value.
 *
 * There is no fillable `<input type="date">` any more — react-aria renders
 * three contenteditable segments plus two non-interactive inputs sharing the
 * `name` (a hidden validation sentinel and a `form=""` value carrier), so
 * `locator('input[name="date"]').fill(...)` silently times out. Focus the day
 * segment and type the digits; react-aria advances through dd → mm → aaaa.
 */
export async function fillDate(scope: Page | Locator, iso: string) {
  const [year, month, day] = iso.split("-");
  const daySegment = scope.getByRole("spinbutton", { name: /^dia/ });
  await daySegment.click();
  await daySegment.pressSequentially(`${day}${month}${year}`);
}

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
