// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import { localJudge, type Judge } from "@/app/lib/judge";
import { solveGrid } from "@/lib/sudoku-solver";
import { geometryOf } from "@/lib/variants";
import { pickVariantGame } from "@/lib/variant-picker";
import { seededRandom } from "@/lib/sudoku-generator";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
  .split("")
  .map(Number);
const solution = solveGrid(puzzle)!;
const empties = puzzle.flatMap((v, i) => (v ? [] : [i]));

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

const cells = () => [...container.querySelectorAll<HTMLButtonElement>(".sudoku [role=gridcell]")];
const live = () => container.querySelector('.sr-only[role="status"]')!;
const said = () => live().textContent;
async function render(extra: Partial<Parameters<typeof SudokuBoard>[0]> = {}, judge?: Judge) {
  await act(async () =>
    root.render(
      <SudokuBoard puzzle={puzzle} judge={judge ?? localJudge(puzzle, solution)} {...extra} />,
    ),
  );
}
/** Presses a key on the focused element, like a keyboard does, and says if the page kept it. */
async function press(key: string, init: KeyboardEventInit = {}) {
  const target = document.activeElement ?? document.body;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}
const focused = () => cells().indexOf(document.activeElement as HTMLButtonElement);
const tabStops = () => cells().flatMap((c, i) => (c.tabIndex === 0 ? [i] : []));

describe("keyboard navigation", () => {
  it("makes the whole grid a single tab stop", async () => {
    await render();
    expect(tabStops()).toEqual([0]); // the first cell until something is selected
    await act(async () => cells()[40].click());
    expect(tabStops()).toEqual([40]);
    expect(cells().filter((c) => c.tabIndex === -1)).toHaveLength(80);
  });

  it("selects a cell as soon as it takes the focus", async () => {
    await render();
    await act(async () => cells()[13].focus());
    expect(cells()[13].getAttribute("aria-selected")).toBe("true");
    expect(tabStops()).toEqual([13]);
  });

  it("moves the selection and the focus with the arrows", async () => {
    await render();
    await act(async () => cells()[40].focus());
    const event = await press("ArrowRight");
    expect(event.defaultPrevented).toBe(true); // the page does not scroll
    expect(focused()).toBe(41);
    await press("ArrowDown");
    expect(focused()).toBe(50);
    await press("ArrowLeft");
    await press("ArrowLeft");
    expect(focused()).toBe(48);
    await press("ArrowUp");
    expect(focused()).toBe(39);
    expect(cells()[39].getAttribute("aria-selected")).toBe("true");
    expect(cells()[41].getAttribute("aria-selected")).toBe("false");
  });

  it("stops at the edges and jumps with Home, End and the Page keys", async () => {
    await render();
    await act(async () => cells()[0].focus());
    await press("ArrowLeft");
    await press("ArrowUp");
    expect(focused()).toBe(0);
    await press("End");
    expect(focused()).toBe(8);
    await press("PageDown");
    expect(focused()).toBe(80);
    await press("Home");
    expect(focused()).toBe(72);
    await press("PageUp");
    expect(focused()).toBe(0);
  });

  it("starts from the first cell when the focus is on the page", async () => {
    await render();
    (document.activeElement as HTMLElement | null)?.blur();
    await press("ArrowDown");
    expect(focused()).toBe(0);
  });

  it("types into the cell that was reached by keyboard", async () => {
    await render();
    await act(async () => cells()[empties[0]].focus());
    await press(String(solution[empties[0]]));
    expect(cells()[empties[0]].textContent).toBe(String(solution[empties[0]]));
    expect(cells()[empties[0]].className).toContain("confirmed");
  });

  it("does not navigate a game that has not started, or one that is lost", async () => {
    await render({ active: false });
    await act(async () => cells()[40].focus());
    await press("ArrowRight");
    expect(focused()).toBe(40);
    await act(async () => root.render(<div />));

    const judge: Judge = { check: async () => ({ correct: false, mistakes: 3 }) };
    await render({}, judge);
    await act(async () => cells()[empties[0]].click());
    await press("1");
    expect(container.querySelector(".loss-result")).not.toBeNull();
    const before = cells().findIndex((c) => c.getAttribute("aria-selected") === "true");
    await press("ArrowRight");
    expect(cells().findIndex((c) => c.getAttribute("aria-selected") === "true")).toBe(before);
  });

  it("navigates a 6×6 grid within its size", async () => {
    const game = pickVariantGame("mini", seededRandom(2));
    await act(async () =>
      root.render(
        <SudokuBoard
          puzzle={game.puzzle}
          judge={localJudge(game.puzzle, game.solution)}
          geometry={geometryOf("mini")}
        />,
      ),
    );
    await act(async () => cells()[0].focus());
    await press("End");
    expect(focused()).toBe(5);
    await press("ArrowRight");
    expect(focused()).toBe(5);
    await press("PageDown");
    expect(focused()).toBe(35);
  });
});

describe("what a screen reader is told", () => {
  it("describes the grid and each cell", async () => {
    await render();
    const grid = container.querySelector(".sudoku")!;
    expect(grid.getAttribute("aria-rowcount")).toBe("9");
    expect(grid.getAttribute("aria-colcount")).toBe("9");
    const given = cells()[0].getAttribute("aria-label")!;
    expect(given).toContain("ligne 1, colonne 1");
    expect(given).toContain("donnée");
    expect(given).toContain("chiffre 5");
    expect(cells()[empties[0]].getAttribute("aria-label")).not.toContain("donnée");
  });

  it("says when a cell is on a diagonal", async () => {
    const game = pickVariantGame("diagonal", seededRandom(3));
    await act(async () =>
      root.render(
        <SudokuBoard
          puzzle={game.puzzle}
          judge={localJudge(game.puzzle, game.solution)}
          geometry={geometryOf("diagonal")}
        />,
      ),
    );
    expect(cells()[0].getAttribute("aria-label")).toContain("sur une diagonale");
    expect(cells()[1].getAttribute("aria-label")).not.toContain("diagonale");
  });

  it("confirms a right digit and says which cell it went into", async () => {
    await render();
    await act(async () => cells()[empties[0]].focus());
    await press(String(solution[empties[0]]));
    const [r, c] = [Math.floor(empties[0] / 9) + 1, (empties[0] % 9) + 1];
    expect(said()).toBe(`Chiffre ${solution[empties[0]]} validé, ligne ${r}, colonne ${c}.`);
  });

  it("reports a wrong digit with the lives left, and the visible message does not repeat it", async () => {
    await render();
    await act(async () => cells()[empties[0]].focus());
    await press(String((solution[empties[0]] % 9) + 1));
    expect(said()).toContain("refusé");
    expect(said()).toContain("2 vies restantes");
    // One voice only: the message under the grid is text to read, not a second live region.
    expect(container.querySelector(".grid-invalid")!.getAttribute("role")).toBeNull();
  });

  it("announces the same line again when the same thing happens twice", async () => {
    await render();
    await act(async () => cells()[empties[0]].focus());
    const wrong = String((solution[empties[0]] % 9) + 1);
    await press(wrong);
    const first = live().firstElementChild;
    await press(wrong);
    expect(live().firstElementChild).not.toBe(first); // a new node: read again
  });

  it("announces the notes mode and the victory", async () => {
    await render();
    await press("n");
    expect(said()).toBe("Mode notes activé.");
    await press("n");
    expect(said()).toBe("Mode notes désactivé.");
    for (const index of empties) {
      await act(async () => cells()[index].focus());
      await press(String(solution[index]));
    }
    expect(said()).toMatch(/^Victoire ! Grille terminée en \d\d:\d\d\.$/);
  });

  it("keeps the announcements out of sight and polite", async () => {
    await render();
    expect(live().className).toBe("sr-only");
    expect(live().getAttribute("aria-live")).toBe("polite");
    expect(live().getAttribute("aria-atomic")).toBe("true");
  });
});
