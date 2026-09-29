// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SudokuBoard } from "@/app/_components/sudoku-board";
import { localJudge, type Judge } from "@/app/lib/judge";
import { SettingsProvider } from "@/app/lib/settings";
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

  it("clears a wrong digit, marks the empty cell red and keeps the server's mistake count", async () => {
    const judge: Judge = {
      check: async ({ index, number }) => ({
        correct: solution[index] === number,
        mistakes: 2,
      }),
    };
    await render(judge);
    const index = empties[0];
    await play(index, (solution[index] % 9) + 1);
    expect(cellButtons()[index].textContent).toBe("");
    expect(cellButtons()[index].className).toContain("wrong");
    expect(cellButtons()[index].getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelectorAll(".lives .full")).toHaveLength(1);
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true })),
    );
    expect(cellButtons()[index].textContent).toBe("");
    await play(index, solution[index]);
    expect(cellButtons()[index].className).not.toContain("wrong");
    expect(cellButtons()[index].className).toContain("confirmed");
  });

  it("locks a confirmed digit against replacement, erasing, notes and undo", async () => {
    const check = vi.fn(localJudge(puzzle, solution).check);
    await render({ check });
    const first = empties[0];
    await play(first, solution[first]);
    expect(cellButtons()[first].getAttribute("aria-readonly")).toBe("true");
    expect(cellButtons()[first].className).toContain("confirmed");
    await play(first, (solution[first] % 9) + 1);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })));
    await play(first, (solution[first] % 9) + 1);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })));
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true })),
    );
    expect(cellButtons()[first].textContent).toBe(String(solution[first]));
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("does not let a late wrong verdict erase a newer confirmed digit", async () => {
    const answers: ((correct: boolean) => void)[] = [];
    const check: Judge["check"] = () =>
      new Promise((resolve) => answers.push((correct) => resolve({ correct })));
    await render({ check });
    const index = empties[0];
    await play(index, (solution[index] % 9) + 1);
    await play(index, solution[index]);
    await act(async () => answers[1](true));
    await act(async () => answers[0](false));
    expect(cellButtons()[index].textContent).toBe(String(solution[index]));
    expect(cellButtons()[index].className).toContain("confirmed");
    expect(container.querySelectorAll(".lives .full")).toHaveLength(2);
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
    await act(async () => cellButtons()[annotated].click());
    expect(cellButtons()[annotated].className).toContain("sel");
    expect(cellButtons()[annotated].getAttribute("aria-label")).toContain("notes");
    await noteKey();
    await play(sameRow, digit);
    expect(notesOf(annotated)).toEqual([String(other)]);
    expect(notesOf(elsewhere)).toEqual([String(digit)]);
  });

  it("explains a hint before revealing its digit", async () => {
    const hint = vi.fn(localJudge(puzzle, solution).hint!);
    await render({ check: localJudge(puzzle, solution).check, hint });
    const hintButton = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Indice"),
    )!;
    await act(async () => hintButton.click());
    const target = cellButtons().findIndex((b) => b.className.includes("hint-target"));
    // The judge is asked about the cell logic points to, and the digit stays hidden.
    expect(hint.mock.calls[0][1]).toBe(target);
    expect(cellButtons()[target].textContent).toBe("");
    const panel = container.querySelector(".hint-panel")!;
    expect(panel.textContent).toContain(`ligne ${Math.floor(target / 9) + 1}`);
    expect(container.querySelectorAll(".hint-unit").length).toBeGreaterThan(0);
    const reveal = [...panel.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Révéler"),
    )!;
    await act(async () => reveal.click());
    expect(cellButtons()[target].textContent).toBe(String(solution[target]));
    expect(container.querySelector(".hint-panel")).toBeNull();
    expect(hintButton.textContent).toContain("(2)");
  });

  it("disables a digit once it is confirmed in all nine places", async () => {
    await render(localJudge(puzzle, solution));
    const keyFor = (n: number) =>
      container.querySelectorAll<HTMLButtonElement>(".keypad button")[n - 1];
    const digit = solution[empties[0]];
    const missing = empties.filter((i) => solution[i] === digit);
    for (const index of missing.slice(0, -1)) await play(index, digit);
    expect(keyFor(digit).disabled).toBe(false);
    await play(missing.at(-1)!, digit);
    expect(keyFor(digit).disabled).toBe(true);
    // The keyboard can no longer place it either.
    const free = empties.find((i) => solution[i] !== digit)!;
    await play(free, digit);
    expect(cellButtons()[free].textContent).toBe("");
  });

  it("saves the game as it goes and resumes it where it was left", async () => {
    const onSnapshot = vi.fn();
    const check = vi.fn(localJudge(puzzle, solution).check);
    await render({ check }, { onSnapshot });
    await play(empties[0], solution[empties[0]]);
    await play(empties[1], (solution[empties[1]] % 9) + 1);
    const snapshot = onSnapshot.mock.lastCall![0];
    expect(snapshot.cells[empties[0]]).toBe(solution[empties[0]]);
    expect(snapshot.mistakes).toBe(1);
    expect(snapshot.cells[empties[1]]).toBe(0);
    expect(snapshot.verdicts.correct[empties[0]]).toBe(solution[empties[0]]);
    expect(snapshot.pending).toEqual([]);

    act(() => root.unmount());
    root = createRoot(container);
    check.mockClear();
    const pending = { index: empties[2], number: solution[empties[2]], id: "pending-entry" };
    const resumed = { ...snapshot, cells: [...snapshot.cells], seconds: 125, pending: [pending] };
    resumed.cells[pending.index] = pending.number;
    await render({ check }, { resume: resumed });
    expect(cellButtons()[empties[0]].textContent).toBe(String(solution[empties[0]]));
    expect(cellButtons()[empties[1]].className).toContain("wrong");
    expect(container.querySelectorAll(".lives .full")).toHaveLength(2);
    expect(container.querySelector(".timer")!.textContent).toBe("02:05");
    // The digit whose verdict never came back is checked again, under the same id.
    expect(check).toHaveBeenCalledTimes(1);
    expect(check.mock.calls[0][0]).toEqual(pending);
  });

  it("stops saving once the game is lost", async () => {
    const onSnapshot = vi.fn();
    await render(localJudge(puzzle, solution), { onSnapshot });
    for (const index of empties.slice(0, 3)) await play(index, (solution[index] % 9) + 1);
    expect(onSnapshot).toHaveBeenLastCalledWith(null);
  });

  it("asks before a new grid throws away a started one", async () => {
    const onNewGame = vi.fn();
    await render(localJudge(puzzle, solution), { onNewGame });
    const newGrid = () =>
      [...container.querySelectorAll<HTMLButtonElement>(".game-actions button")].find(
        (b) => b.classList.contains("abandon-grid"),
      )!;
    expect(newGrid().getAttribute("aria-label")).toContain("Abandonner cette grille");
    expect(newGrid().querySelector("svg")).not.toBeNull();
    const dialog = () => document.querySelector("[role=alertdialog]");
    // Nothing played yet: nothing to lose.
    await act(async () => newGrid().click());
    expect(onNewGame).toHaveBeenCalledTimes(1);
    await play(empties[0], solution[empties[0]]);
    await act(async () => newGrid().click());
    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(dialog()).not.toBeNull();
    const choose = async (label: string) => {
      const button = [...dialog()!.querySelectorAll("button")].find(
        (b) => b.textContent === label,
      )!;
      await act(async () => button.click());
    };
    await choose("Continuer la partie");
    expect(dialog()).toBeNull();
    expect(onNewGame).toHaveBeenCalledTimes(1);
    await act(async () => newGrid().click());
    await choose("Abandonner et relancer");
    expect(onNewGame).toHaveBeenCalledTimes(2);
  });

  it("follows the player's settings", async () => {
    window.localStorage.setItem(
      "sudoklash:settings",
      JSON.stringify({ highlightUnits: false, showTimer: false, confirmNewGrid: false }),
    );
    const onNewGame = vi.fn();
    await act(async () =>
      root.render(
        <SettingsProvider>
          <SudokuBoard puzzle={puzzle} judge={localJudge(puzzle, solution)} onNewGame={onNewGame} />
        </SettingsProvider>,
      ),
    );
    await play(empties[0], solution[empties[0]]);
    expect(container.querySelector(".timer")).toBeNull();
    expect(container.querySelectorAll(".sudoku button.line")).toHaveLength(0);
    const newGrid = [...container.querySelectorAll<HTMLButtonElement>(".game-actions button")].find(
      (b) => b.classList.contains("abandon-grid"),
    )!;
    await act(async () => newGrid.click());
    expect(onNewGame).toHaveBeenCalledTimes(1);
    window.localStorage.removeItem("sudoklash:settings");
  });

  it("sums the game up on the victory screen", async () => {
    await render(localJudge(puzzle, solution), { previousBest: 3600 });
    await play(empties[0], (solution[empties[0]] % 9) + 1);
    for (const index of empties) await play(index, solution[index]);
    const victory = container.querySelector(".victory")!;
    expect(victory.querySelector(".victory-stats")!.textContent).toContain("1/3");
    expect(victory.querySelector(".victory-record")!.textContent).toContain("Nouveau record");
    expect(victory.textContent).toContain("Partager");
  });
});
