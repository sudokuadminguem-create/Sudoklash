// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import { localJudge } from "@/app/lib/judge";
import { SettingsProvider } from "@/app/lib/settings";
import { solveGrid } from "@/lib/sudoku-solver";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A bank grid where the next deduction needs a naked pair.
const puzzle = "003000600610200003004060018580406372240000006376852194090600031007100000102040007"
  .split("")
  .map(Number);
const solution = solveGrid(puzzle)!;

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("hints that teach a technique", () => {
  it("names the technique and circles its cells on the grid", async () => {
    await act(async () =>
      root.render(
        <SettingsProvider>
          <SudokuBoard puzzle={puzzle} judge={localJudge(puzzle, solution)} />
        </SettingsProvider>,
      ),
    );
    const hintButton = [...container.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.startsWith("Afficher un indice"),
    )!;
    await act(async () => hintButton.click());

    const chips = [...container.querySelectorAll(".hint-techniques li")].map(
      (li) => li.textContent,
    );
    expect(chips).toContain("Paire nue");
    expect(container.querySelector(".hint-panel")!.textContent).toContain("Paire nue");
    expect(container.querySelectorAll(".sudoku .hint-pattern")).toHaveLength(2);
    expect(container.querySelectorAll(".sudoku .hint-target")).toHaveLength(1);
    expect(container.querySelector(".hint-legend")).not.toBeNull();

    // Dismissing the hint clears the highlights.
    const dismiss = container.querySelector<HTMLButtonElement>(".hint-dismiss")!;
    await act(async () => dismiss.click());
    expect(container.querySelectorAll(".sudoku .hint-pattern")).toHaveLength(0);
    expect(container.querySelector(".hint-techniques")).toBeNull();
  });
});
