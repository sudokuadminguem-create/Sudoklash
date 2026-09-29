import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type Started = { puzzle: number[]; solution: number[] };
const KEY = "sudoklash:settings";

/** Starts the page with these settings already saved, as if chosen on an earlier visit. */
const withSettings = (page: Page, settings: object) =>
  page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [KEY, JSON.stringify(settings)],
  );

/** Opens the app and waits until React has taken over (see solo.spec.ts). */
async function open(page: Page) {
  const hydrated = page.waitForResponse((response) => response.url().endsWith("/api/me"));
  await page.goto("/");
  await hydrated;
}

async function startGame(page: Page) {
  const started = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/solo") &&
      response.request().postData()?.includes('"start"') === true,
  );
  await page
    .locator(".difficulty-grid button")
    .filter({ has: page.locator("b", { hasText: /^Débutant$/ }) })
    .click();
  const game = (await (await started).json()) as Started;
  await expect(page.locator(".sudoku")).toBeVisible();
  return game;
}

const dataset = (page: Page) => page.evaluate(() => ({ ...document.documentElement.dataset }));

test("the display settings apply at once and survive a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await page.locator("nav button", { hasText: "Paramètres" }).click();
  await page.getByRole("switch", { name: /Contraste élevé/ }).check();
  await page.getByRole("switch", { name: /Mode daltonien/ }).check();
  await page.getByRole("radio", { name: "Très grande" }).click();
  expect(await dataset(page)).toMatchObject({
    contrast: "high",
    colorblind: "on",
    fontScale: "xlarge",
  });

  await page.reload();
  expect(await dataset(page)).toMatchObject({
    contrast: "high",
    colorblind: "on",
    fontScale: "xlarge",
  });
});

test("the look is set before the page is drawn, so it never flashes", async ({ page }) => {
  await withSettings(page, { highContrast: true, fontScale: "large" });
  await page.goto("/", { waitUntil: "commit" });
  await page.waitForFunction(() => !!document.documentElement.dataset.contrast);
  // Nothing of the app has run yet at this point: only the script in <head> could have set it.
  expect(await dataset(page)).toMatchObject({ contrast: "high", fontScale: "large" });
});

test("a system that asks for more contrast gets it without any setting", async ({ page }) => {
  await page.emulateMedia({ contrast: "more" });
  await open(page);
  expect((await dataset(page)).contrast).toBe("high");
  await page.emulateMedia({ contrast: "no-preference" });
});

test("high contrast passes the enhanced contrast check on the main screens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await withSettings(page, { highContrast: true });
  const check = async () =>
    (
      await new AxeBuilder({ page })
        .withRules(["color-contrast-enhanced", "color-contrast"])
        .analyze()
    ).violations.map((v) => ({ rule: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));

  await open(page);
  expect(await check()).toEqual([]);
  await startGame(page);
  expect(await check()).toEqual([]);
  await page.locator("nav button", { hasText: "Paramètres" }).click();
  await expect(page.getByRole("switch", { name: /Contraste élevé/ })).toBeChecked();
  expect(await check()).toEqual([]);
});

test("a wrong digit is marked by a cross and stripes in colour-blind mode", async ({ page }) => {
  await withSettings(page, { colorblind: true });
  await open(page);
  const game = await startGame(page);
  const cell = page.locator(".sudoku [role=gridcell]").nth(game.puzzle.indexOf(0));
  const index = game.puzzle.indexOf(0);
  await cell.click();
  await page.keyboard.press(String((game.solution[index] % 9) + 1));
  await expect(cell).toHaveAttribute("aria-invalid", "true");
  const image = await cell.evaluate((el) => getComputedStyle(el).backgroundImage);
  // A drawn cross over stripes: the mark does not depend on seeing red.
  expect(image).toContain("data:image/svg+xml");
  expect(image).toContain("repeating-linear-gradient");
  expect(await page.locator(".grid-invalid").textContent()).toContain("Chiffre incorrect");
});

test("the largest text size fits a phone without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withSettings(page, { fontScale: "xlarge" });
  const sideways = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  await open(page);
  expect(await page.evaluate(() => getComputedStyle(document.body).zoom)).toBe("1.3");
  expect(await sideways()).toBeLessThanOrEqual(0);
  await startGame(page);
  expect(await sideways()).toBeLessThanOrEqual(0);
  // The whole grid is still on screen.
  const box = (await page.locator(".sudoku").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});
