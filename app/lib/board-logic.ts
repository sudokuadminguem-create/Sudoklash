// Pure rules of the Sudoku board, kept out of the React component so they can be tested alone.

import { formatClock } from "@/app/lib/format-time";

/** Pencil marks by cell index. */
export type Notes = Record<number, number[]>;
/** What the judge said about each digit placed: accepted ones are locked. */
export type Verdicts = { correct: Record<number, number>; wrong: Record<number, number> };
/** One step of the undo history. */
export type HistoryStep = { cells: number[]; notes: Notes };

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const MAX_MISTAKES = 3;

/** Whether two cells share a row, a column or a 3×3 box. */
export const sameUnit = (a: number, b: number) =>
  a % 9 === b % 9 ||
  Math.floor(a / 9) === Math.floor(b / 9) ||
  (Math.floor(a / 27) === Math.floor(b / 27) &&
    Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3));

/** Adds the note `n` to a cell, or removes it when it is already there. */
export function toggleNote(notes: Notes, index: number, n: number): Notes {
  const current = notes[index] || [];
  return {
    ...notes,
    [index]: current.includes(n) ? current.filter((x) => x !== n) : [...current, n].sort(),
  };
}

/**
 * Notes after `n` is placed in `index`: that cell has no notes left and, when asked, `n` is no
 * longer a candidate in its row, column and box.
 */
export function notesAfterPlacing(
  notes: Notes,
  index: number,
  n: number,
  removeFromUnit: boolean,
): Notes {
  return Object.fromEntries(
    Object.entries(notes).map(([key, marks]) => {
      const i = Number(key);
      if (i === index) return [key, []];
      return [key, removeFromUnit && sameUnit(i, index) ? marks.filter((x) => x !== n) : marks];
    }),
  );
}

/**
 * The board to go back to when undoing: the saved step, except that rejected digits stay out
 * and confirmed digits stay in, since undo must not change what the judge decided.
 */
export function stepBack(last: HistoryStep, verdicts: Verdicts, current: readonly number[]) {
  const cells = [...last.cells];
  const notes = { ...last.notes };
  for (const [key, number] of Object.entries(verdicts.wrong))
    if (cells[Number(key)] === number) cells[Number(key)] = 0;
  for (const [key, number] of Object.entries(verdicts.correct)) {
    const index = Number(key);
    if (current[index] === number) {
      cells[index] = number;
      notes[index] = [];
    }
  }
  return { cells, notes };
}

/** Digits confirmed in all nine places: there is nowhere left to put them. */
export function completedDigitsOf(
  cells: readonly number[],
  puzzle: readonly number[],
  verdicts: Verdicts,
) {
  return new Set<number>(
    DIGITS.filter(
      (n) =>
        cells.filter((v, i) => v === n && (puzzle[i] === n || verdicts.correct[i] === n)).length ===
        9,
    ),
  );
}

/** Whether a cell holds a right digit: a given, or a digit the judge confirmed. */
export const isConfirmed = (
  puzzle: readonly number[],
  verdicts: Verdicts,
  grid: readonly number[],
  i: number,
) => !!puzzle[i] || (!!grid[i] && verdicts.correct[i] === grid[i]);

/** Cells shown as related to a hint: its unit if it has one, else its row, column and box. */
export function hintUnitCells(index: number, unit?: readonly number[]) {
  return new Set(unit ?? Array.from({ length: 81 }, (_, i) => i).filter((i) => sameUnit(i, index)));
}

/** How this game compares with the player's best time, or null when there is nothing to show. */
export function personalRecord(previousBest: number | null | undefined, seconds: number) {
  if (previousBest === undefined) return null;
  if (previousBest === null) return { label: "Premier record établi", best: true };
  return seconds < previousBest
    ? { label: `Nouveau record · −${formatClock(previousBest - seconds)}`, best: true }
    : { label: `Record : ${formatClock(previousBest)}`, best: false };
}

/** Share of the empty cells that are filled, as a whole percentage. */
export const progressPercent = (filled: number, givens: number) =>
  Math.round(((filled - givens) / (81 - givens)) * 100);

/** The text a player shares after a game. */
export function shareText(game: {
  title: string;
  difficulty: string;
  time: string;
  mistakes: number;
  hintsUsed: number;
}) {
  const lives =
    "❤️".repeat(Math.max(0, MAX_MISTAKES - game.mistakes)) +
    "🤍".repeat(Math.min(MAX_MISTAKES, game.mistakes));
  return `Sudoku Clash · ${game.title} ${game.difficulty}\n⏱ ${game.time} ${lives} 💡 ${game.hintsUsed}`;
}
