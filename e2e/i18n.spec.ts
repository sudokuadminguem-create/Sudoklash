import { expect, test, type Page } from "@playwright/test";

const open = async (page: Page) => {
  const me = page.waitForResponse((r) => r.url().endsWith("/api/me"));
  await page.goto("/");
  await me;
};
/** Clicks an entry of the main menu, opening the menu first on a phone. */
const goTo = async (page: Page, entry: "first" | "last") => {
  const menu = page.locator(".menub");
  if (await menu.isVisible()) await menu.click();
  const buttons = page.locator("aside nav button");
  await (entry === "first" ? buttons.first() : buttons.last()).click();
};
const openSettings = async (page: Page) => {
  await goTo(page, "last");
  await expect(page.locator(".settings-panel")).toBeVisible();
};

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("gets the interface in English, and can go back to French for good", async ({ page }) => {
    await open(page);
    await expect(page.locator("h1")).toHaveText("Game center");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator(".mode-tabs")).toContainText("Friend duel");

    await openSettings(page);
    await page.getByRole("radio", { name: "Français" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator(".settings-panel h2")).toHaveText("Paramètres de jeu");

    const me = page.waitForResponse((r) => r.url().endsWith("/api/me"));
    await page.reload();
    await me;
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await goTo(page, "first");
    await expect(page.locator("h1")).toHaveText("Centre de jeu");
  });

  test("plays a game with English labels", async ({ page }) => {
    await open(page);
    await page
      .locator(".difficulty-grid button")
      .filter({ has: page.locator("b", { hasText: /^Beginner$/ }) })
      .click();
    await expect(page.getByRole("grid")).toHaveAttribute(
      "aria-label",
      "Sudoku grid 9 by 9, Beginner level",
    );
    await expect(page.locator('[aria-label="Number pad"]')).toBeVisible();
  });
});

test.describe("French browser", () => {
  test.use({ locale: "fr-FR" });

  test("keeps the French interface", async ({ page }) => {
    await open(page);
    await expect(page.locator("h1")).toHaveText("Centre de jeu");
  });
});
