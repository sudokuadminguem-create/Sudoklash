import { expect, test, type Page } from "@playwright/test";

type Started = { guest: boolean; puzzle: number[]; solution: number[] };

// Not the "practice" starts the app makes in the background to stock its offline grids.
const isStart = (request: { url(): string; postData(): string | null }) =>
  request.url().endsWith("/api/solo") &&
  request.postData()?.includes('"start"') === true &&
  !request.postData()?.includes('"practice"');

const difficultyButton = (page: Page, name: string) =>
  page.locator(".difficulty-grid button").filter({
    has: page.locator("b", { hasText: new RegExp(`^${name}$`) }),
  });

/** Picks a difficulty and returns the grid the server handed out (guests get its solution). */
async function startGame(page: Page, difficulty = "Débutant") {
  const started = page.waitForResponse((response) => isStart(response.request()));
  await difficultyButton(page, difficulty).click();
  const game = (await (await started).json()) as Started;
  await expect(page.locator(".sudoku")).toBeVisible();
  return game;
}

const cell = (page: Page, index: number) => page.locator(".sudoku [role=gridcell]").nth(index);
const emptyCells = (game: Started) => game.puzzle.flatMap((value, index) => (value ? [] : [index]));

async function play(page: Page, index: number, digit: number) {
  await cell(page, index).click();
  await page.keyboard.press(String(digit));
}

/**
 * Opens the app and waits until React has taken over: the server-rendered buttons show up
 * before their handlers work, and /api/me is only asked for once the app is running.
 */
async function open(page: Page, reload = false) {
  const hydrated = page.waitForResponse((response) => response.url().endsWith("/api/me"));
  if (reload) await page.reload();
  else await page.goto("/");
  await hydrated;
}

test.beforeEach(async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Choisis ta difficulté" })).toBeVisible();
});

test("offers the six solo difficulties", async ({ page }) => {
  for (const name of ["Débutant", "Facile", "Intermédiaire", "Difficile", "Expert", "Maître"])
    await expect(difficultyButton(page, name)).toBeVisible();
});

test("a guest solves a grid and is invited to sign in", async ({ page }) => {
  const game = await startGame(page);
  for (const index of emptyCells(game)) await play(page, index, game.solution[index]);

  const victory = page.locator(".victory");
  await expect(victory).toBeVisible();
  await expect(victory.getByRole("heading", { name: "Victoire !" })).toBeVisible();
  await expect(victory).toContainText("Grille Débutant terminée");
  await expect(victory.locator(".victory-stats")).toContainText("0/3");
  await expect(victory.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(victory.getByRole("button", { name: "Nouvelle grille" })).toBeEnabled();
});

test("three wrong digits lose the grid", async ({ page }) => {
  const game = await startGame(page);
  const [target] = emptyCells(game);
  await expect(page.locator(".lives")).toHaveAttribute("aria-label", /3 vies restantes/);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wrong = ((game.solution[target] + attempt - 1) % 9) + 1;
    await play(page, target, wrong);
    await expect(page.locator(".lives")).toHaveAttribute(
      "aria-label",
      new RegExp(`${3 - attempt} vies? restantes?`),
    );
  }
  await expect(page.getByRole("heading", { name: "Grille perdue" })).toBeVisible();
  await expect(cell(page, target)).toBeDisabled();
});

test("a right digit is locked, a wrong one is cleared", async ({ page }) => {
  const game = await startGame(page);
  const [first, second] = emptyCells(game);
  await play(page, first, game.solution[first]);
  await expect(cell(page, first)).toHaveText(String(game.solution[first]));
  await expect(cell(page, first)).toHaveAttribute("aria-readonly", "true");

  await play(page, second, (game.solution[second] % 9) + 1);
  await expect(cell(page, second)).toHaveText("");
  await expect(cell(page, second)).toHaveAttribute("aria-invalid", "true");
});

test("notes do not count as answers", async ({ page }) => {
  const game = await startGame(page);
  const [target] = emptyCells(game);
  await page.getByRole("button", { name: "Activer ou désactiver les notes" }).click();
  await play(page, target, 4);
  await expect(cell(page, target).locator(".cell-notes")).toContainText("4");
  await expect(page.locator(".lives")).toHaveAttribute("aria-label", /3 vies restantes/);
});

test("a hint explains before it reveals the digit", async ({ page }) => {
  await startGame(page);
  await page.getByRole("button", { name: /Afficher un indice/ }).click();
  const panel = page.locator(".hint-panel");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Révéler le chiffre" }).click();
  await expect(panel).toBeHidden();
  const filled = await page.locator(".sudoku .confirmed").count();
  expect(filled).toBe(1);
});

test("abandoning asks first, then deals a new grid", async ({ page }) => {
  const game = await startGame(page);
  const [target] = emptyCells(game);
  await play(page, target, game.solution[target]);

  await page.getByRole("button", { name: /Abandonner cette grille/ }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Abandonner cette grille ?");

  await dialog.getByRole("button", { name: "Continuer la partie" }).click();
  await expect(dialog).toBeHidden();
  await expect(cell(page, target)).toHaveText(String(game.solution[target]));

  await page.getByRole("button", { name: /Abandonner cette grille/ }).click();
  const next = page.waitForResponse((response) => isStart(response.request()));
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Abandonner et relancer" })
    .click();
  await next;
  await expect(page.locator(".sudoku")).toBeVisible();
  await expect(dialog).toBeHidden();
});

test("a game in progress can be resumed after a reload", async ({ page }) => {
  const game = await startGame(page);
  const [first, second] = emptyCells(game);
  await play(page, first, game.solution[first]);
  await play(page, second, game.solution[second]);

  await open(page, true);
  const resume = page.getByRole("button", { name: /Reprendre ma partie/ });
  await expect(resume).toContainText("Débutant");
  await resume.click();
  await expect(cell(page, first)).toHaveText(String(game.solution[first]));
  await expect(cell(page, second)).toHaveText(String(game.solution[second]));
});
