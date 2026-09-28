// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import { localJudge, type Judge } from "@/app/lib/judge";
import { solveGrid } from "@/lib/sudoku-solver";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
  .split("")
  .map(Number);
const solution = solveGrid(puzzle)!;
const empties = puzzle.flatMap((value, i) => (value ? [] : [i]));

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

const cellButtons = () => [...container.querySelectorAll<HTMLButtonElement>(".sudoku button")];
async function play(index: number, number: number) {
  await act(async () => cellButtons()[index].click());
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: String(number) }));
  });
}
async function render(judge: Judge, extra: Partial<Parameters<typeof SudokuBoard>[0]> = {}) {
  await act(async () => root.render(<SudokuBoard puzzle={puzzle} judge={judge} {...extra} />));
}

describe("sudoku board", () => {
  it("asks the judge about each digit and wins once all are confirmed", async () => {
    const onSolved = vi.fn();
    const check = vi.fn(localJudge(puzzle, solution).check);
    await render({ check }, { onSolved });
    for (const index of empties) await play(index, solution[index]);
    expect(check).toHaveBeenCalledTimes(empties.length);
    expect(onSolved).toHaveBeenCalledWith(solution, expect.any(Number), puzzle);
    expect(container.querySelector(".victory")).not.toBeNull();
  });

  it("shows wrong digits and uses the server's mistake count", async () => {
    const judge: Judge = { check: async () => ({ correct: false, mistakes: 2 }) };
    await render(judge);
    const index = empties[0];
    await play(index, (solution[index] % 9) + 1);
    expect(cellButtons()[index].className).toContain("wrong");
    expect(container.querySelectorAll(".lives .full")).toHaveLength(1);
  });

  it("lets the player retry when the check fails", async () => {
    let fail = true;
    const judge: Judge = {
      check: async () => {
        if (fail) throw new Error("offline");
        return { correct: true };
      },
    };
    await render(judge);
    await play(empties[0], solution[empties[0]]);
    const retry = container.querySelector<HTMLButtonElement>(".retry-mistake")!;
    expect(retry).not.toBeNull();
    fail = false;
    await act(async () => retry.click());
    expect(container.querySelector(".retry-mistake")).toBeNull();
    expect(cellButtons()[empties[0]].className).not.toContain("wrong");
  });

  it("keeps the board playable while checks are in flight", async () => {
    const onSolved = vi.fn();
    const answers: (() => void)[] = [];
    const judge: Judge = {
      check: (entry) =>
        new Promise((resolve) =>
          answers.push(() => resolve({ correct: solution[entry.index] === entry.number })),
        ),
    };
    await render(judge, { onSolved });
    for (const index of empties) await play(index, solution[index]);
    expect(answers).toHaveLength(empties.length);
    expect(cellButtons()[empties.at(-1)!].textContent).toBe(String(solution[empties.at(-1)!]));
    expect(onSolved).not.toHaveBeenCalled();
    // Verdicts arrive late and out of order.
    for (const answer of answers.reverse()) await act(async () => answer());
    expect(onSolved).toHaveBeenCalledWith(solution, expect.any(Number), puzzle);
  });

  it("never lowers the mistake count when verdicts arrive out of order", async () => {
    const answers: ((mistakes: number) => void)[] = [];
    const judge: Judge = {
      check: () =>
        new Promise((resolve) => answers.push((mistakes) => resolve({ correct: false, mistakes }))),
    };
    await render(judge);
    await play(empties[0], (solution[empties[0]] % 9) + 1);
    await play(empties[1], (solution[empties[1]] % 9) + 1);
    await act(async () => answers[1](2));
    await act(async () => answers[0](1));
    expect(container.querySelectorAll(".lives .full")).toHaveLength(1);
  });

  it("removes a placed digit from the notes of its row, column and box", async () => {
    await render(localJudge(puzzle, solution));
    const noteKey = async () =>
      act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })));
    const notesOf = (index: number) =>
      [...cellButtons()[index].querySelectorAll(".cell-notes i")]
        .map((note) => note.textContent)
        .filter(Boolean);
    // Cell 2 shares a row with cell 3; cell 77 shares nothing with it.
    const [annotated, sameRow, elsewhere] = [2, 3, 77];
    const digit = solution[sameRow];
    const other = (digit % 9) + 1;
    await noteKey();
    await play(annotated, digit);
    await play(annotated, other);
    await play(elsewhere, digit);
    await noteKey();
    await play(sameRow, digit);
    expect(notesOf(annotated)).toEqual([String(other)]);
    expect(notesOf(elsewhere)).toEqual([String(digit)]);
  });

  it("places the judge's hint", async () => {
    await render(localJudge(puzzle, solution));
    const hintButton = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Indice"),
    )!;
    await act(async () => hintButton.click());
    expect(cellButtons()[empties[0]].textContent).toBe(String(solution[empties[0]]));
  });
});
