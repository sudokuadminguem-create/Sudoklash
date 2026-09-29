// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import {
  completedDigitsOf,
  digitsFor,
  notesAfterPlacing,
  progressPercent,
} from "@/app/lib/board-logic";
import { localJudge } from "@/app/lib/judge";
import { pickVariantGame } from "@/lib/variant-picker";
import { seededRandom } from "@/lib/sudoku-generator";
import { areRelated, geometryOf } from "@/lib/variants";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const cells = () => [...container.querySelectorAll<HTMLButtonElement>(".sudoku button")];
const press = async (index: number, digit: number) => {
  await act(async () => cells()[index].click());
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: String(digit) }));
  });
};

async function renderVariant(id: "mini" | "diagonal" | "killer", seed = 1) {
  const game = pickVariantGame(id, seededRandom(seed));
  const geometry = geometryOf(id, game.cages);
  const onSolved = vi.fn();
  const { check } = localJudge(game.puzzle, game.solution);
  await act(async () =>
    root.render(
      <SudokuBoard
        puzzle={game.puzzle}
        judge={{ check }}
        geometry={geometry}
        difficulty="Variante"
        hintsAllowed={0}
        onSolved={onSolved}
      />,
    ),
  );
  return { ...game, onSolved };
}

describe("logic on other grids", () => {
  it("has one digit per row of the grid", () => {
    expect(digitsFor(6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(digitsFor(9)).toHaveLength(9);
  });

  it("finds completed digits by the size of the grid", () => {
    const cells = Array(36).fill(0);
    const correct: Record<number, number> = {};
    for (let i = 0; i < 6; i++) {
      cells[i * 6] = 4;
      correct[i * 6] = 4;
    }
    expect([...completedDigitsOf(cells, Array(36).fill(0), { correct, wrong: {} }, 6)]).toEqual([
      4,
    ]);
    // Six of a digit is not enough on a 9×9 grid.
    expect(completedDigitsOf(cells, Array(36).fill(0), { correct, wrong: {} }, 9).size).toBe(0);
  });

  it("removes a note from the diagonal and the cage, not only from row, column and box", () => {
    const diagonal = geometryOf("diagonal");
    // Cell 0 and cell 40 share only the diagonal.
    expect(notesAfterPlacing({ 40: [5, 6] }, 0, 5, true, diagonal)[40]).toEqual([6]);
    expect(notesAfterPlacing({ 40: [5, 6] }, 0, 5, true)[40]).toEqual([5, 6]);
    const killer = geometryOf("killer", [{ cells: [0, 40], sum: 9 }]);
    expect(notesAfterPlacing({ 40: [5, 6], 41: [5] }, 0, 5, true, killer)).toEqual({
      40: [6],
      41: [5],
    });
  });

  it("measures progress against the size of the grid", () => {
    expect(progressPercent(20, 10, 36)).toBe(38); // 10 of 26 empty cells
    expect(progressPercent(36, 10, 36)).toBe(100);
  });
});

describe("board with a variant geometry", () => {
  it("plays a 6×6 grid: six digits, six columns, wins when all cells are right", async () => {
    const { puzzle, solution, onSolved } = await renderVariant("mini");
    expect(cells()).toHaveLength(36);
    expect(container.querySelectorAll(".keypad button")).toHaveLength(6);
    expect(container.querySelector(".sudoku")!.getAttribute("aria-label")).toContain("6 par 6");
    expect(container.querySelectorAll(".sudoku-row")).toHaveLength(6);
    const empty = puzzle.indexOf(0);
    await press(empty, 7); // no 7 on a 6×6 grid
    expect(cells()[empty].textContent).toBe("");
    expect(container.querySelectorAll(".lives .full")).toHaveLength(3);
    for (const [i, value] of puzzle.entries()) if (!value) await press(i, solution[i]);
    expect(onSolved).toHaveBeenCalledWith(solution, expect.any(Number), puzzle);
    expect(container.querySelector(".victory")).not.toBeNull();
  });

  it("puts a box border every two rows and three columns on a 6×6 grid", async () => {
    await renderVariant("mini");
    const rows = [...container.querySelectorAll(".sudoku-row")].map((r) =>
      r.classList.contains("block-bottom"),
    );
    expect(rows).toEqual([false, true, false, true, false, false]);
  });

  it("marks both diagonals of a diagonal grid", async () => {
    await renderVariant("diagonal");
    const marked = cells().flatMap((b, i) => (b.classList.contains("diag") ? [i] : []));
    expect(marked).toHaveLength(17);
    expect(marked).toEqual(expect.arrayContaining([0, 10, 40, 80, 8, 72]));
  });

  it("highlights the diagonal as related cells when one is selected", async () => {
    await renderVariant("diagonal");
    await act(async () => cells()[0].click());
    expect(cells()[40].className).toContain("line"); // on the same diagonal
    expect(cells()[41].className).not.toContain("line");
  });

  it("shows the sum of each cage once and outlines the cage", async () => {
    const { cages } = await renderVariant("killer");
    const sums = [...container.querySelectorAll(".cage-sum")].map((n) => Number(n.textContent));
    expect(sums.sort((a, b) => a - b)).toEqual(cages.map((c) => c.sum).sort((a, b) => a - b));
    const cage = cages.find((c) => c.cells.length >= 3)!;
    const edges = (i: number) =>
      [...cells()[i].classList].filter((c) => c.startsWith("cage-") && c !== "cage-sum");
    for (const cell of cage.cells) {
      const [r, c] = [Math.floor(cell / 9), cell % 9];
      const inCage = (other: number) => cage.cells.includes(other);
      // A side is outlined exactly when the neighbour is outside the cage.
      expect(edges(cell).includes("cage-t")).toBe(r === 0 || !inCage(cell - 9));
      expect(edges(cell).includes("cage-b")).toBe(r === 8 || !inCage(cell + 9));
      expect(edges(cell).includes("cage-l")).toBe(c === 0 || !inCage(cell - 1));
      expect(edges(cell).includes("cage-r")).toBe(c === 8 || !inCage(cell + 1));
      expect(cells()[cell].getAttribute("aria-label")).toContain(`cage de somme ${cage.sum}`);
    }
  });

  it("removes a confirmed digit from the notes along a diagonal, not only row, column and box", async () => {
    const { puzzle, solution } = await renderVariant("diagonal");
    const box = (cell: number) => Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3);
    const main = [...Array(9).keys()].map((i) => i * 10).filter((cell) => !puzzle[cell]);
    // Two empty cells of the main diagonal in different boxes: related only by the diagonal.
    const a = main[0];
    const b = main.find((cell) => box(cell) !== box(a))!;
    expect(areRelated(geometryOf(undefined), a, b)).toBe(false);
    expect(areRelated(geometryOf("diagonal"), a, b)).toBe(true);
    const digit = solution[a];
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
    });
    await press(b, digit); // a note on b
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
    });
    const notesOf = (i: number) =>
      [...cells()[i].querySelectorAll(".cell-notes i")].map((n) => n.textContent).filter(Boolean);
    expect(notesOf(b)).toEqual([String(digit)]);
    await press(a, digit); // confirmed by the judge
    expect(notesOf(b)).toEqual([]);
  });

  it("keeps the classic grid free of variant marks", async () => {
    const puzzle = Array(81).fill(0);
    await act(async () =>
      root.render(
        <SudokuBoard puzzle={puzzle} judge={{ check: async () => ({ correct: true }) }} />,
      ),
    );
    expect(container.querySelectorAll(".diag, .cage, .cage-sum")).toHaveLength(0);
    expect(cells()).toHaveLength(81);
    expect(container.querySelectorAll(".keypad button")).toHaveLength(9);
  });
});
