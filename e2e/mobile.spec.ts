import { expect, test, type Page } from "@playwright/test";

/** Opens a guest game with the given stored settings. */
async function openGame(page: Page, settings: object) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sudoklash:settings", JSON.stringify(value));
  }, settings);
  await page.goto("/");
  const me = page.waitForResponse((r) => r.url().endsWith("/api/me"));
  await me;
  await page
    .locator(".difficulty-grid button")
    .filter({ has: page.locator("b", { hasText: /^Débutant$/ }) })
    .click();
  await expect(page.locator(".sudoku")).toBeVisible();
}

const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

test.describe("mobile ergonomics", () => {
  test.use({ viewport: { width: 393, height: 851 }, hasTouch: true });

  test("keypad and action buttons are comfortable touch targets", async ({ page }) => {
    await openGame(page, {});
    for (const b of await page.locator(".keypad button").all())
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    for (const b of await page.locator(".game-actions button:visible").all())
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  for (const hand of ["right", "left"] as const)
    test(`one-handed mode (${hand}) docks a 3×3 pad under the thumb`, async ({ page }) => {
      await openGame(page, { oneHanded: hand });
      const pad = await box(page, ".keypad");
      const actions = await box(page, ".game-actions");
      // The digits sit on the side of the hand, the actions on the other.
      if (hand === "right") expect(pad.x).toBeGreaterThan(actions.x);
      else expect(pad.x).toBeLessThan(actions.x);
      for (const b of await page.locator(".keypad button").all()) {
        const size = (await b.boundingBox())!;
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
      // Three columns of digits: the ninth key sits in the third row and column.
      const first = (await page.locator(".keypad button").nth(0).boundingBox())!;
      const ninth = (await page.locator(".keypad button").nth(8).boundingBox())!;
      expect(ninth.y).toBeGreaterThan(first.y + first.height);
      expect(ninth.x).toBeGreaterThan(first.x + first.width);
      // The dock is pinned inside the viewport.
      const dock = await box(page, ".board-dock");
      expect(dock.y + dock.height).toBeLessThanOrEqual(851 + 1);
    });
});
