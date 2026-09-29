// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsPanel } from "@/app/_components/settings-panel";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import { I18nProvider } from "@/app/lib/i18n";
import { localJudge } from "@/app/lib/judge";
import { SettingsProvider } from "@/app/lib/settings";
import { solveGrid } from "@/lib/sudoku-solver";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
  .split("")
  .map(Number);
const solution = solveGrid(puzzle)!;
const empty = puzzle.findIndex((v) => !v);

const browserLanguage = (value: string) =>
  Object.defineProperty(navigator, "language", { value, configurable: true });

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  window.localStorage.clear();
  browserLanguage("fr-FR");
  document.documentElement.lang = "fr";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const renderApp = () =>
  act(async () =>
    root.render(
      <I18nProvider>
        <SettingsProvider>
          <SettingsPanel notify={() => {}} />
          <SudokuBoard puzzle={puzzle} judge={localJudge(puzzle, solution)} difficulty="Facile" />
        </SettingsProvider>
      </I18nProvider>,
    ),
  );
const choose = (name: string) =>
  act(async () =>
    [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find((b) => b.textContent === name)!
      .click(),
  );
const label = (text: string) => container.querySelector(`[aria-label="${text}"]`);

describe("language", () => {
  it("starts in French and switches the whole game to English, then back", async () => {
    await renderApp();
    expect(label("Clavier numérique")).not.toBeNull();
    expect(container.textContent).toContain("Paramètres de jeu");

    await choose("English");
    expect(document.documentElement.lang).toBe("en");
    expect(label("Number pad")).not.toBeNull();
    expect(label("Place digit 5")).not.toBeNull();
    expect(label("Sudoku grid 9 by 9, Easy level")).not.toBeNull();
    expect(container.textContent).toContain("Game settings");
    expect(container.textContent).toContain("Hint (3)");
    expect(container.querySelector(".game-top .eyebrow")?.textContent).toBe("NORMAL GAME · EASY");
    expect(container.querySelector(".sudoku button")?.getAttribute("aria-label")).toBe(
      "Cell row 1, column 1, given, digit 5",
    );

    await choose("Français");
    expect(document.documentElement.lang).toBe("fr");
    expect(label("Clavier numérique")).not.toBeNull();
  });

  it("keeps the choice for the next visit", async () => {
    await renderApp();
    await choose("English");
    expect(window.localStorage.getItem("sudoklash:locale")).toBe("en");
    await act(async () => root.unmount());
    root = createRoot(container);
    await renderApp();
    expect(label("Number pad")).not.toBeNull();
  });

  it("follows the browser language before any choice is made", async () => {
    browserLanguage("en-GB");
    await renderApp();
    expect(label("Number pad")).not.toBeNull();
    expect(window.localStorage.getItem("sudoklash:locale")).toBeNull();
  });

  it("announces moves in English", async () => {
    window.localStorage.setItem("sudoklash:locale", "en");
    await renderApp();
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".sudoku button")[empty].click(),
    );
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: String(solution[empty]) })),
    );
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })));
    expect(container.querySelector('[role="status"].sr-only')?.textContent).toBe("Notes mode on.");
  });
});
