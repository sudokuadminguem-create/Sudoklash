// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import { SettingsPanel } from "@/app/_components/settings-panel";
import { canVibrate, haptic, hapticPatterns } from "@/app/lib/haptics";
import { localJudge } from "@/app/lib/judge";
import { SettingsProvider } from "@/app/lib/settings";
import { solveGrid } from "@/lib/sudoku-solver";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
  .split("")
  .map(Number);
const solution = solveGrid(puzzle)!;
const empty = puzzle.findIndex((v) => !v);

let root: Root, container: HTMLDivElement;
const vibrate = vi.fn();
beforeEach(() => {
  window.localStorage.clear();
  vibrate.mockReset();
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (navigator as { vibrate?: unknown }).vibrate;
});

const renderBoard = () =>
  act(async () =>
    root.render(
      <SettingsProvider>
        <SudokuBoard puzzle={puzzle} judge={localJudge(puzzle, solution)} />
      </SettingsProvider>,
    ),
  );
const dock = () => container.querySelector<HTMLElement>(".board-dock")!;

describe("haptics", () => {
  it("plays the pattern of each kind of feedback", () => {
    haptic("win");
    expect(vibrate).toHaveBeenCalledWith(hapticPatterns.win);
    expect(canVibrate()).toBe(true);
  });

  it("is a silent no-op where the device cannot vibrate, or refuses", () => {
    vibrate.mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => haptic("tap")).not.toThrow();
    delete (navigator as { vibrate?: unknown }).vibrate;
    expect(canVibrate()).toBe(false);
    expect(() => haptic("bad")).not.toThrow();
  });
});

describe("mobile settings on the board", () => {
  it("ticks on keypad presses only when asked to", async () => {
    await renderBoard();
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".sudoku button")[empty].click(),
    );
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Placer le chiffre 1"]')!.click(),
    );
    expect(vibrate).not.toHaveBeenCalled();

    window.localStorage.setItem("sudoklash:settings", JSON.stringify({ hapticKeys: true }));
    await act(async () => root.unmount());
    root = createRoot(container);
    await renderBoard();
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".sudoku button")[empty].click(),
    );
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Placer le chiffre 2"]')!.click(),
    );
    expect(vibrate).toHaveBeenCalledWith(hapticPatterns.tap);
  });

  it("docks the controls on the chosen side from the settings panel", async () => {
    await act(async () =>
      root.render(
        <SettingsProvider>
          <SettingsPanel notify={() => {}} />
          <SudokuBoard puzzle={puzzle} judge={localJudge(puzzle, solution)} />
        </SettingsProvider>,
      ),
    );
    expect(dock().dataset.hand).toBe("off");
    const choose = (name: string) =>
      act(async () =>
        [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
          .find((b) => b.textContent === name)!
          .click(),
      );
    await choose("Main gauche");
    expect(dock().dataset.hand).toBe("left");
    await choose("Main droite");
    expect(dock().dataset.hand).toBe("right");
    expect(JSON.parse(window.localStorage.getItem("sudoklash:settings")!).oneHanded).toBe("right");
  });

  it("ignores an unknown one-handed value in storage", async () => {
    window.localStorage.setItem("sudoklash:settings", JSON.stringify({ oneHanded: "both" }));
    await renderBoard();
    expect(dock().dataset.hand).toBe("off");
  });
});
