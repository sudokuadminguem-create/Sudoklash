// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import { localJudge } from "@/app/lib/judge";
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

const cells = () => [...container.querySelectorAll<HTMLButtonElement>(".sudoku button")];
const key = (init: KeyboardEventInit) =>
  act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", init));
  });
const select = (index: number) => act(async () => cells()[index].click());
const press = async (index: number, digit: number) => {
  await select(index);
  await key({ key: String(digit) });
};
const notesOf = (index: number) =>
  [...cells()[index].querySelectorAll(".cell-notes i")].map((n) => n.textContent).filter(Boolean);
const button = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const click = (label: string) => act(async () => button(label).click());
const noteMode = () => key({ key: "n" });

async function render(extra: Partial<Parameters<typeof SudokuBoard>[0]> = {}) {
  await act(async () =>
    root.render(<SudokuBoard puzzle={puzzle} judge={localJudge(puzzle, solution)} {...extra} />),
  );
}

describe("undo and redo", () => {
  it("brings an undone note back, and only until a new move is made", async () => {
    await render();
    const [a, b] = empties;
    await noteMode();
    await press(a, 1);
    await press(a, 2);
    expect(notesOf(a)).toEqual(["1", "2"]);

    await click("Annuler la dernière action");
    expect(notesOf(a)).toEqual(["1"]);
    expect(button("Rétablir l’action annulée").disabled).toBe(false);
    await click("Rétablir l’action annulée");
    expect(notesOf(a)).toEqual(["1", "2"]);
    expect(button("Rétablir l’action annulée").disabled).toBe(true);

    await click("Annuler la dernière action");
    await press(b, 3); // a new move ends the redo history
    expect(button("Rétablir l’action annulée").disabled).toBe(true);
    expect(notesOf(a)).toEqual(["1"]);
  });

  it("redoes from the keyboard with Ctrl+Y and Ctrl+Shift+Z", async () => {
    await render();
    await noteMode();
    await press(empties[0], 5);
    await key({ key: "z", ctrlKey: true });
    expect(notesOf(empties[0])).toEqual([]);
    await key({ key: "y", ctrlKey: true });
    expect(notesOf(empties[0])).toEqual(["5"]);
    await key({ key: "z", ctrlKey: true });
    await key({ key: "Z", ctrlKey: true, shiftKey: true });
    expect(notesOf(empties[0])).toEqual(["5"]);
  });

  it("keeps a long history instead of forgetting the first moves", async () => {
    await render();
    const target = empties[0];
    await noteMode();
    await select(target);
    // 60 note changes: more than the 40 steps the board used to remember.
    for (let n = 0; n < 60; n++) await key({ key: String((n % 9) + 1) });
    expect(notesOf(target).length).toBeGreaterThan(0);
    for (let n = 0; n < 60; n++) await click("Annuler la dernière action");
    expect(notesOf(target)).toEqual([]);
    expect(button("Annuler la dernière action").disabled).toBe(true);
    for (let n = 0; n < 60; n++) await click("Rétablir l’action annulée");
    expect(button("Rétablir l’action annulée").disabled).toBe(true);
  });

  it("does not bring back a digit the judge confirmed or rejected", async () => {
    await render();
    const [a, b] = empties;
    await press(a, solution[a]); // confirmed
    await press(b, (solution[b] % 9) + 1); // rejected
    await click("Annuler la dernière action");
    await click("Annuler la dernière action");
    expect(cells()[a].textContent).toBe(String(solution[a])); // locked
    await click("Rétablir l’action annulée");
    await click("Rétablir l’action annulée");
    expect(cells()[a].textContent).toBe(String(solution[a]));
    expect(cells()[b].textContent).toBe("");
  });
});

describe("notes stay right", () => {
  // Cells 2 and 3 share row 0; cell 77 shares nothing with cell 2.
  const [a, sameRow, elsewhere] = [2, 3, 77];

  it("keeps the neighbours' notes when the digit is wrong", async () => {
    await render();
    await noteMode();
    await press(sameRow, solution[a]);
    await noteMode();
    await press(a, (solution[a] % 9) + 1); // wrong digit
    expect(cells()[a].textContent).toBe("");
    expect(notesOf(sameRow)).toEqual([String(solution[a])]);
  });

  it("removes the digit from the neighbours' notes once it is confirmed", async () => {
    await render();
    await noteMode();
    await press(sameRow, solution[a]);
    await press(elsewhere, solution[a]);
    await noteMode();
    await press(a, solution[a]);
    expect(notesOf(sameRow)).toEqual([]);
    expect(notesOf(elsewhere)).toEqual([String(solution[a])]);
  });

  it("checks the notes against the confirmed digits and reports it", async () => {
    await render();
    await press(a, solution[a]);
    // Notes added afterwards are not pruned on their own.
    await noteMode();
    await press(sameRow, solution[a]);
    await press(sameRow, solution[sameRow]);
    expect(notesOf(sameRow)).toEqual([String(solution[sameRow]), String(solution[a])].sort());

    await click("Vérifier les notes");
    expect(notesOf(sameRow)).toEqual([String(solution[sameRow])]);
    expect(container.querySelector(".note-report")!.textContent).toBe("1 note impossible retirée.");

    await click("Annuler la dernière action");
    expect(notesOf(sameRow)).toHaveLength(2);

    await click("Vérifier les notes");
    await click("Vérifier les notes");
    expect(container.querySelector(".note-report")!.textContent).toContain("cohérentes");
  });

  it("offers no note check in a competitive game", async () => {
    await render({ competitive: true });
    expect(container.querySelector('button[aria-label="Vérifier les notes"]')).toBeNull();
  });
});
