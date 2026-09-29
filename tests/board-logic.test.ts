import { describe, expect, it } from "vitest";
import {
  cellPlace,
  isMoveKey,
  moveSelection,
  verdictAnnouncement,
  completedDigitsOf,
  hintUnitCells,
  isConfirmed,
  notesAfterPlacing,
  personalRecord,
  progressPercent,
  pushHistory,
  MAX_HISTORY,
  type HistoryStep,
  sameUnit,
  shareText,
  stepBack,
  toggleNote,
  type Verdicts,
} from "@/app/lib/board-logic";

const noVerdicts: Verdicts = { correct: {}, wrong: {} };

describe("sameUnit", () => {
  it("relates cells of the same row, column or box", () => {
    expect(sameUnit(0, 8)).toBe(true); // row
    expect(sameUnit(0, 72)).toBe(true); // column
    expect(sameUnit(0, 20)).toBe(true); // box
    expect(sameUnit(0, 30)).toBe(false);
    expect(sameUnit(20, 30)).toBe(false); // rows and columns differ, boxes differ
  });

  it("is true for a cell and itself and symmetric", () => {
    for (const [a, b] of [
      [4, 4],
      [10, 55],
      [40, 44],
    ])
      expect(sameUnit(a, b)).toBe(sameUnit(b, a));
    expect(sameUnit(40, 40)).toBe(true);
  });
});

describe("notes", () => {
  it("toggles a note on and off, keeping them sorted", () => {
    let notes = toggleNote({}, 5, 7);
    notes = toggleNote(notes, 5, 2);
    expect(notes[5]).toEqual([2, 7]);
    notes = toggleNote(notes, 5, 7);
    expect(notes[5]).toEqual([2]);
  });

  it("does not mutate the notes it is given", () => {
    const before = { 1: [3] };
    toggleNote(before, 1, 4);
    expect(before).toEqual({ 1: [3] });
  });

  it("clears the cell and removes the digit from its unit when asked", () => {
    const notes = { 0: [1, 5], 1: [5, 6], 40: [5], 10: [5, 9] };
    // Placing 5 in cell 0: cells 1 (row) and 10 (box) lose the note, 40 is elsewhere.
    expect(notesAfterPlacing(notes, 0, 5, true)).toEqual({ 0: [], 1: [6], 40: [5], 10: [9] });
  });

  it("only clears the placed cell when auto-removal is off", () => {
    const notes = { 0: [1, 5], 1: [5, 6] };
    expect(notesAfterPlacing(notes, 0, 5, false)).toEqual({ 0: [], 1: [5, 6] });
  });
});

describe("undo", () => {
  const last = { cells: [1, 2, 3, 0], notes: { 3: [4] } };

  it("restores the saved board", () => {
    const { cells, notes } = stepBack(last, noVerdicts, [1, 2, 3, 0]);
    expect(cells).toEqual([1, 2, 3, 0]);
    expect(notes).toEqual({ 3: [4] });
  });

  it("does not bring back a digit the judge rejected", () => {
    const { cells } = stepBack(last, { correct: {}, wrong: { 1: 2 } }, [1, 0, 3, 0]);
    expect(cells).toEqual([1, 0, 3, 0]);
  });

  it("keeps a confirmed digit and drops its notes", () => {
    const { cells, notes } = stepBack(last, { correct: { 3: 9 }, wrong: {} }, [1, 2, 3, 9]);
    expect(cells).toEqual([1, 2, 3, 9]);
    expect(notes[3]).toEqual([]);
  });

  it("does not touch the saved step", () => {
    stepBack(last, { correct: { 3: 9 }, wrong: { 0: 1 } }, [1, 2, 3, 9]);
    expect(last).toEqual({ cells: [1, 2, 3, 0], notes: { 3: [4] } });
  });
});

describe("confirmed digits", () => {
  it("counts givens and judged-correct digits only", () => {
    const puzzle = [5, 0, 0];
    const verdicts = { correct: { 1: 4 }, wrong: { 2: 7 } };
    expect(isConfirmed(puzzle, verdicts, [5, 4, 7], 0)).toBe(true);
    expect(isConfirmed(puzzle, verdicts, [5, 4, 7], 1)).toBe(true);
    expect(isConfirmed(puzzle, verdicts, [5, 3, 7], 1)).toBe(false); // replaced since
    expect(isConfirmed(puzzle, verdicts, [5, 4, 7], 2)).toBe(false);
    expect(isConfirmed(puzzle, verdicts, [5, 4, 0], 2)).toBe(false);
  });

  it("finds digits placed correctly nine times", () => {
    const puzzle = Array(81).fill(0);
    const cells = Array(81).fill(0);
    const correct: Record<number, number> = {};
    for (let i = 0; i < 9; i++) {
      cells[i * 9] = 4; // nine 4s, all confirmed
      correct[i * 9] = 4;
      cells[i * 9 + 1] = 6; // nine 6s, one unconfirmed
      if (i) correct[i * 9 + 1] = 6;
    }
    expect([...completedDigitsOf(cells, puzzle, { correct, wrong: {} })]).toEqual([4]);
    puzzle[0] = 4;
    expect(completedDigitsOf(puzzle, puzzle, noVerdicts).has(4)).toBe(false); // one given only
  });
});

describe("hints", () => {
  it("uses the row, column and box of the cell when the hint has no unit", () => {
    const cells = hintUnitCells(0);
    expect(cells.size).toBe(21);
    expect(cells.has(8) && cells.has(72) && cells.has(20)).toBe(true);
    expect(cells.has(30)).toBe(false);
  });

  it("uses the unit of the hint when it has one", () => {
    expect([...hintUnitCells(0, [1, 2, 3])]).toEqual([1, 2, 3]);
  });
});

describe("game summary", () => {
  it("compares with the previous best time", () => {
    expect(personalRecord(undefined, 100)).toBeNull();
    expect(personalRecord(null, 100)).toEqual({ label: "Premier record établi", best: true });
    expect(personalRecord(200, 150)).toEqual({ label: "Nouveau record · −00:50", best: true });
    expect(personalRecord(200, 200)).toEqual({ label: "Record : 03:20", best: false });
    expect(personalRecord(200, 250)?.best).toBe(false);
  });

  it("gives the progress of the empty cells as a percentage", () => {
    expect(progressPercent(30, 30)).toBe(0);
    expect(progressPercent(81, 30)).toBe(100);
    expect(progressPercent(56, 31)).toBe(50);
  });

  it("writes the text to share", () => {
    expect(
      shareText({ title: "Arène", difficulty: "Facile", time: "03:20", mistakes: 1, hintsUsed: 2 }),
    ).toBe("Sudoku Clash · Arène Facile\n⏱ 03:20 ❤️❤️🤍 💡 2");
  });
});

describe("history", () => {
  it("keeps the most recent steps up to the limit", () => {
    let history: HistoryStep[] = [];
    for (let n = 0; n < MAX_HISTORY + 20; n++)
      history = pushHistory(history, { cells: [n], notes: {} });
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].cells[0]).toBe(20);
    expect(history.at(-1)!.cells[0]).toBe(MAX_HISTORY + 19);
  });
});

describe("keyboard navigation", () => {
  it("recognises the keys that move around the grid", () => {
    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ])
      expect(isMoveKey(key)).toBe(true);
    for (const key of ["a", "1", "Enter", "Tab", "Escape", " "]) expect(isMoveKey(key)).toBe(false);
    expect(moveSelection(40, "Enter", 9)).toBeNull();
  });

  it("moves one cell with the arrows", () => {
    expect(moveSelection(40, "ArrowUp", 9)).toBe(31);
    expect(moveSelection(40, "ArrowDown", 9)).toBe(49);
    expect(moveSelection(40, "ArrowLeft", 9)).toBe(39);
    expect(moveSelection(40, "ArrowRight", 9)).toBe(41);
  });

  it("stops at the edges instead of wrapping around", () => {
    expect(moveSelection(4, "ArrowUp", 9)).toBe(4);
    expect(moveSelection(76, "ArrowDown", 9)).toBe(76);
    expect(moveSelection(9, "ArrowLeft", 9)).toBe(9); // first column: not the end of the row above
    expect(moveSelection(17, "ArrowRight", 9)).toBe(17); // last column: not the next row
  });

  it("jumps to the ends of the row and the column", () => {
    expect(moveSelection(40, "Home", 9)).toBe(36);
    expect(moveSelection(40, "End", 9)).toBe(44);
    expect(moveSelection(40, "PageUp", 9)).toBe(4);
    expect(moveSelection(40, "PageDown", 9)).toBe(76);
  });

  it("starts from the first cell when nothing is selected", () => {
    for (const key of ["ArrowDown", "ArrowLeft", "End", "PageDown"])
      expect(moveSelection(null, key, 9)).toBe(0);
  });

  it("works on a 6×6 grid", () => {
    expect(moveSelection(14, "ArrowRight", 6)).toBe(15);
    expect(moveSelection(5, "ArrowRight", 6)).toBe(5);
    expect(moveSelection(14, "End", 6)).toBe(17);
    expect(moveSelection(14, "PageDown", 6)).toBe(32);
    expect(moveSelection(14, "ArrowDown", 6)).toBe(20);
  });
});

describe("announcements", () => {
  it("says where a cell is", () => {
    expect(cellPlace(0, 9)).toBe("ligne 1, colonne 1");
    expect(cellPlace(40, 9)).toBe("ligne 5, colonne 5");
    expect(cellPlace(14, 6)).toBe("ligne 3, colonne 3");
  });

  it("confirms a right digit", () => {
    expect(verdictAnnouncement({ correct: true, number: 5, index: 20, size: 9, mistakes: 1 })).toBe(
      "Chiffre 5 validé, ligne 3, colonne 3.",
    );
  });

  it("reports a wrong digit with the lives left, in the singular and the plural", () => {
    const wrong = (mistakes: number) =>
      verdictAnnouncement({ correct: false, number: 7, index: 0, size: 9, mistakes });
    expect(wrong(1)).toBe("Chiffre 7 refusé, ligne 1, colonne 1. 2 vies restantes.");
    expect(wrong(2)).toBe("Chiffre 7 refusé, ligne 1, colonne 1. 1 vie restante.");
    expect(wrong(3)).toContain("grille perdue");
    expect(wrong(4)).toContain("grille perdue"); // never a negative count
  });
});
