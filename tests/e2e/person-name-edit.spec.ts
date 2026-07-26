import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

test("editing a person's name: outside click and Escape both cancel, Salvar renames", async ({ page }) => {
  const personName = `E2E Name Edit Person ${Date.now()}`;
  const renamedTo = `E2E Renamed Person ${Date.now()}`;

  await loginAsAdmin(page);

  const newPersonInput = page.getByPlaceholder("NOVO DEVEDOR");
  await newPersonInput.fill(personName);
  await newPersonInput.press("Enter");
  await page.getByRole("link", { name: personName }).click();
  const heading = page.getByRole("heading", { name: personName });
  await expect(heading).toBeVisible();

  // --- Outside click cancels edit mode without saving ---
  await heading.click();
  const nameInput = page.getByPlaceholder("NOME");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("SHOULD NOT SAVE (outside click)");
  await page.mouse.click(5, 5);
  await expect(nameInput).not.toBeVisible();
  await expect(page.getByRole("heading", { name: personName })).toBeVisible();

  // --- Escape cancels edit mode without saving ---
  await page.getByRole("heading", { name: personName }).click();
  await expect(nameInput).toBeVisible();
  await nameInput.fill("SHOULD NOT SAVE (escape)");
  await page.keyboard.press("Escape");
  await expect(nameInput).not.toBeVisible();
  await expect(page.getByRole("heading", { name: personName })).toBeVisible();

  // --- Salvar actually renames the person ---
  await page.getByRole("heading", { name: personName }).click();
  await nameInput.fill(renamedTo);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: renamedTo })).toBeVisible();
  await expect(page.getByRole("heading", { name: personName })).not.toBeVisible();

  // The dashboard's own list link reflects the new name too.
  await page.goto("/");
  await expect(page.getByRole("link", { name: renamedTo })).toBeVisible();
  await expect(page.getByRole("link", { name: personName })).not.toBeVisible();

  // Clean up via the real UI delete flow.
  await page.getByRole("link", { name: renamedTo }).click();
  await page.getByRole("button", { name: "Excluir devedor" }).click();
  await page.getByRole("button", { name: "EXCLUIR", exact: true }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: renamedTo })).not.toBeVisible();
});
