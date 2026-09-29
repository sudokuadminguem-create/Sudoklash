import { describe, expect, it } from "vitest";
import {
  completedDigitsOf,
  hintUnitCells,
  isConfirmed,
  notesAfterPlacing,
  personalRecord,
  progressPercent,
  pruneNotes,
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

describe("note checking", () => {
  it("removes candidates that a confirmed digit rules out", () => {
    // Cell 0 confirmed as 5: cells 1 (row), 9 (column) and 10 (box) cannot hold a 5.
    const confirmed = Array(81).fill(0);
    confirmed[0] = 5;
    const { notes, removed } = pruneNotes({ 1: [5, 6], 9: [5], 10: [2, 5], 40: [5] }, confirmed);
    expect(notes).toEqual({ 1: [6], 9: [], 10: [2], 40: [5] });
    expect(removed).toBe(3);
  });

  it("clears the notes of a cell that is already filled", () => {
    const confirmed = Array(81).fill(0);
    confirmed[4] = 7;
    expect(pruneNotes({ 4: [1, 7] }, confirmed)).toEqual({ notes: { 4: [] }, removed: 2 });
  });

  it("leaves consistent notes alone and does not mutate its input", () => {
    const notes = { 1: [1, 2] };
    const confirmed = Array(81).fill(0);
    confirmed[80] = 9;
    expect(pruneNotes(notes, confirmed)).toEqual({ notes: { 1: [1, 2] }, removed: 0 });
    expect(notes).toEqual({ 1: [1, 2] });
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
