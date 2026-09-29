import { expect, test, type Page } from "@playwright/test";

type Started = {
  guest: boolean;
  variant: string;
  puzzle: number[];
  solution: number[];
  cages: { cells: number[]; sum: number }[];
};

/** Opens the app and waits until React has taken over (see solo.spec.ts). */
async function open(page: Page) {
  const hydrated = page.waitForResponse((response) => response.url().endsWith("/api/me"));
  await page.goto("/");
  await hydrated;
}

const variantButton = (page: Page, label: string) =>
  page.locator(".variant-grid button").filter({
    has: page.locator("b", { hasText: new RegExp(`^${label}$`) }),
  });

async function startVariant(page: Page, label: string, variant: string) {
  const started = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/solo") &&
      response.request().postData()?.includes(variant) === true,
  );
  await variantButton(page, label).click();
  const game = (await (await started).json()) as Started;
  await expect(page.locator(".sudoku")).toBeVisible();
  return game;
}

const cell = (page: Page, index: number) => page.locator(".sudoku [role=gridcell]").nth(index);

async function solve(page: Page, game: Started) {
  for (const [index, value] of game.puzzle.entries()) {
    if (value) continue;
    await cell(page, index).click();
    await page.keyboard.press(String(game.solution[index]));
  }
}

test.beforeEach(async ({ page }) => {
  await open(page);
});

test("the solo picker offers the three variants with their experience", async ({ page }) => {
  for (const [label, xp] of [
    ["Mini 6×6", 25],
    ["Diagonale", 70],
    ["Killer", 100],
  ] as const)
    await expect(variantButton(page, label)).toContainText(`+${xp} XP`);
});

test("a 6×6 grid has six digits and six columns, and can be solved", async ({ page }) => {
  const game = await startVariant(page, "Mini 6×6", "mini");
  expect(game.puzzle).toHaveLength(36);
  await expect(page.locator(".sudoku [role=gridcell]")).toHaveCount(36);
  await expect(page.locator(".keypad button")).toHaveCount(6);
  await expect(page.locator(".sudoku")).toHaveAttribute("aria-label", /6 par 6/);
  await solve(page, game);
  await expect(page.locator(".victory")).toBeVisible();
  await expect(page.locator(".victory")).toContainText("Grille Mini 6×6 terminée");
});

test("a digit above the grid size is ignored on a 6×6 grid", async ({ page }) => {
  const game = await startVariant(page, "Mini 6×6", "mini");
  const empty = game.puzzle.indexOf(0);
  await cell(page, empty).click();
  await page.keyboard.press("7");
  await expect(cell(page, empty)).toHaveText("");
  await expect(page.locator(".lives")).toHaveAttribute("aria-label", /3 vies restantes/);
});

test("a diagonal grid marks both diagonals and can be solved", async ({ page }) => {
  const game = await startVariant(page, "Diagonale", "diagonal");
  await expect(page.locator(".sudoku button.diag")).toHaveCount(17); // 9 + 9 - the shared centre
  await solve(page, game);
  await expect(page.locator(".victory")).toContainText("Grille Diagonale terminée");
});

test("a killer grid outlines its cages, shows every sum and can be solved", async ({ page }) => {
  const game = await startVariant(page, "Killer", "killer");
  await expect(page.locator(".sudoku .cage-sum")).toHaveCount(game.cages.length);
  const sums = await page.locator(".sudoku .cage-sum").allTextContents();
  expect(sums.map(Number).sort((a, b) => a - b)).toEqual(
    game.cages.map((c) => c.sum).sort((a, b) => a - b),
  );
  // The label of a cell names its cage, for screen readers.
  const first = game.cages[0];
  await expect(cell(page, Math.min(...first.cells))).toHaveAttribute(
    "aria-label",
    new RegExp(`cage de somme ${first.sum}`),
  );
  await solve(page, game);
  await expect(page.locator(".victory")).toContainText("Grille Killer terminée");
});

test("variants give no hints", async ({ page }) => {
  await startVariant(page, "Diagonale", "diagonal");
  await expect(page.getByRole("button", { name: /Afficher un indice/ })).toBeDisabled();
});

test("a variant game in progress is resumed after a reload", async ({ page }) => {
  const game = await startVariant(page, "Killer", "killer");
  const [first] = game.puzzle.flatMap((v, i) => (v ? [] : [i]));
  await cell(page, first).click();
  await page.keyboard.press(String(game.solution[first]));
  await expect(cell(page, first)).toHaveText(new RegExp(`${game.solution[first]}$`));

  await open(page);
  const resume = page.getByRole("button", { name: /Reprendre ma partie/ });
  await expect(resume).toContainText("Killer");
  await resume.click();
  await expect(page.locator(".sudoku .cage-sum")).toHaveCount(game.cages.length);
  await expect(cell(page, first)).toHaveText(new RegExp(`${game.solution[first]}$`));
});
