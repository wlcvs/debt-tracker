import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

test("Escape closes only the MethodSelect dropdown, not the whole create-debt form", async ({ page }) => {
  const personName = `E2E MethodSelect Person ${Date.now()}`;

  await loginAsAdmin(page);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();
  await expect(page.getByRole("heading", { name: personName })).toBeVisible();

  await page.getByRole("button", { name: "+ Adicionar dívida" }).click();
  const titleInput = page.getByPlaceholder("TÍTULO");
  await expect(titleInput).toBeVisible();
  await titleInput.fill("Regression debt");

  // Select Pix first so we can assert Escape preserves it, not resets it.
  // The toggle button's accessible name includes the "▾" glyph ("Pix ▾"),
  // so a non-exact match is what finds it once selected; exact:true is
  // reserved for the dropdown's option buttons, whose text is just "Pix".
  const toggleShowingPix = page.getByRole("button", { name: /^Pix/ });
  await page.getByRole("button", { name: "— Método —" }).click();
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await expect(toggleShowingPix).toBeVisible();

  // Reopen the dropdown, then dismiss it with Escape.
  await toggleShowingPix.click();
  const dinheiroOption = page.getByRole("button", { name: "Dinheiro", exact: true });
  await expect(dinheiroOption).toBeVisible();
  await page.keyboard.press("Escape");

  // The dropdown option list should be gone...
  await expect(dinheiroOption).not.toBeVisible();
  // ...but the outer form must still be open with its previously-entered
  // data intact — this is the exact bug: Escape used to bubble to the
  // form's own useDismiss and reset() the whole thing.
  await expect(titleInput).toBeVisible();
  await expect(titleInput).toHaveValue("Regression debt");
  await expect(toggleShowingPix).toBeVisible();

  // Cancel the form and clean up the scratch person.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: personName })).not.toBeVisible();
});
