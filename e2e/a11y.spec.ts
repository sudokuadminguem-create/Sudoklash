import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type Started = { puzzle: number[]; solution: number[] };
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Opens the app and waits until React has taken over (see solo.spec.ts). */
async function open(page: Page) {
  const hydrated = page.waitForResponse((response) => response.url().endsWith("/api/me"));
  await page.goto("/");
  await hydrated;
}

const violations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations.map((v) => ({
    rule: v.id,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));

async function startGame(page: Page) {
  const started = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/solo") &&
      response.request().postData()?.includes('"start"') === true &&
      // Not the background "practice" starts that stock the offline grids.
      !response.request().postData()?.includes('"practice"'),
  );
  await page
    .locator(".difficulty-grid button")
    .filter({ has: page.locator("b", { hasText: /^Débutant$/ }) })
    .click();
  const game = (await (await started).json()) as Started;
  await expect(page.locator(".sudoku")).toBeVisible();
  return game;
}

test("the home page has no automatic accessibility violation", async ({ page }) => {
  await open(page);
  expect(await violations(page)).toEqual([]);
});

test("neither does a game in progress", async ({ page }) => {
  await open(page);
  await startGame(page);
  expect(await violations(page)).toEqual([]);
});

test("the skip link jumps to the content", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
});

test("a grid can be played with the keyboard alone", async ({ page }) => {
  await open(page);
  const game = await startGame(page);
  const cell = (index: number) => page.locator(`.sudoku [data-cell="${index}"]`);

  // The grid is one tab stop: Tab from the top of the page reaches its first cell.
  await page.locator(".solo-bar b").focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator(".sudoku [tabindex='0']")).toHaveCount(1);
  await cell(0).focus();

  // Walk to each empty cell with the arrows and type its digit.
  let at = 0;
  for (const [index, value] of game.puzzle.entries()) {
    if (value) continue;
    const [dr, dc] = [Math.floor(index / 9) - Math.floor(at / 9), (index % 9) - (at % 9)];
    for (let n = 0; n < Math.abs(dr); n++)
      await page.keyboard.press(dr > 0 ? "ArrowDown" : "ArrowUp");
    for (let n = 0; n < Math.abs(dc); n++)
      await page.keyboard.press(dc > 0 ? "ArrowRight" : "ArrowLeft");
    await expect(cell(index)).toBeFocused();
    await page.keyboard.press(String(game.solution[index]));
    at = index;
  }
  await expect(page.locator(".victory")).toBeVisible();
  await expect(page.locator('.sr-only[role="status"]')).toContainText("Victoire");
});

test("the arrow keys move the selection instead of scrolling the page", async ({ page }) => {
  // Tall enough to see the whole grid: nothing needs to scroll, so any scroll would be the
  // browser's own reaction to the arrow keys.
  await page.setViewportSize({ width: 1280, height: 2200 });
  await open(page);
  await startGame(page);
  await page.locator('.sudoku [data-cell="0"]').focus();
  const before = await page.evaluate(() => window.scrollY);
  for (let n = 0; n < 5; n++) await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await expect(page.locator('.sudoku [data-cell="45"]')).toBeFocused();
  await expect(page.locator('.sudoku [data-cell="45"]')).toBeInViewport();
});
