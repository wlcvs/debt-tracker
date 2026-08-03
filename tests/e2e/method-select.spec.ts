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
  // Radix's Select.Trigger declares role="combobox", which overrides the
  // implicit button role, so getByRole("button") no longer finds it; its
  // accessible name still trails the "▾" glyph, hence the loose match.
  const trigger = page.getByRole("combobox", { name: "Método" });
  await trigger.click();
  await page.getByRole("option", { name: "Pix" }).click();
  await expect(trigger).toContainText("Pix");

  // Reopen the dropdown, then dismiss it with Escape.
  await trigger.click();
  const dinheiroOption = page.getByRole("option", { name: "Dinheiro" });
  await expect(dinheiroOption).toBeVisible();
  await page.keyboard.press("Escape");

  // The dropdown option list should be gone...
  await expect(dinheiroOption).not.toBeVisible();
  // ...but the outer form must still be open with its previously-entered
  // data intact — this is the exact bug: Escape used to bubble to the
  // form's own useDismiss and reset() the whole thing.
  await expect(titleInput).toBeVisible();
  await expect(titleInput).toHaveValue("Regression debt");
  await expect(trigger).toContainText("Pix");

  // Arrow-key navigation, which the hand-rolled dropdown never supported.
  // Radix moves the highlight inside a setTimeout, so wait for focus to land
  // before committing — pressing Enter immediately re-selects the current item.
  await trigger.click();
  const dinheiro = page.getByRole("option", { name: "Dinheiro" });
  await expect(dinheiro).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(dinheiro).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("Dinheiro");

  // Cancel the form and clean up the scratch person.
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: personName })).not.toBeVisible();
});
