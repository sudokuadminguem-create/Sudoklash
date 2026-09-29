// Pure rules of the Sudoku board, kept out of the React component so they can be tested alone.

import { formatClock } from "@/app/lib/format-time";
import { tFr, type Translate } from "@/app/lib/i18n-core";
import { areRelated, CLASSIC, type Geometry } from "@/lib/variants";

/** Pencil marks by cell index. */
export type Notes = Record<number, number[]>;
/** What the judge said about each digit placed: accepted ones are locked. */
export type Verdicts = { correct: Record<number, number>; wrong: Record<number, number> };
/** One step of the undo history. */
export type HistoryStep = { cells: number[]; notes: Notes };

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
/** The digits of a grid of the given side. */
export const digitsFor = (size: number) => DIGITS.filter((n) => n <= size);
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
  geometry: Geometry = CLASSIC,
): Notes {
  return Object.fromEntries(
    Object.entries(notes).map(([key, marks]) => {
      const i = Number(key);
      if (i === index) return [key, []];
      return [
        key,
        removeFromUnit && areRelated(geometry, i, index) ? marks.filter((x) => x !== n) : marks,
      ];
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

/** Most steps kept for undo: a whole game is a few hundred moves. */
export const MAX_HISTORY = 500;

/** The history with one more step, oldest steps dropped past the limit. */
export const pushHistory = (history: HistoryStep[], step: HistoryStep) => [
  ...history.slice(-(MAX_HISTORY - 1)),
  step,
];

/** Digits confirmed in all nine places: there is nowhere left to put them. */
export function completedDigitsOf(
  cells: readonly number[],
  puzzle: readonly number[],
  verdicts: Verdicts,
  size = 9,
) {
  return new Set<number>(
    digitsFor(size).filter(
      (n) =>
        cells.filter((v, i) => v === n && (puzzle[i] === n || verdicts.correct[i] === n)).length ===
        size,
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
export function personalRecord(
  previousBest: number | null | undefined,
  seconds: number,
  t: Translate = tFr,
) {
  if (previousBest === undefined) return null;
  if (previousBest === null) return { label: t("record.first"), best: true };
  return seconds < previousBest
    ? { label: t("record.new", { delta: formatClock(previousBest - seconds) }), best: true }
    : { label: t("record.best", { time: formatClock(previousBest) }), best: false };
}

/** Share of the empty cells that are filled, as a whole percentage. */
export const progressPercent = (filled: number, givens: number, total = 81) =>
  Math.round(((filled - givens) / (total - givens)) * 100);

/** The text a player shares after a game. */
export function shareText(
  game: {
    title: string;
    difficulty: string;
    time: string;
    mistakes: number;
    hintsUsed: number;
  },
  t: Translate = tFr,
) {
  const lives =
    "❤️".repeat(Math.max(0, MAX_MISTAKES - game.mistakes)) +
    "🤍".repeat(Math.min(MAX_MISTAKES, game.mistakes));
  return t("share.text", {
    title: game.title,
    level: game.difficulty,
    time: game.time,
    lives,
    hints: game.hintsUsed,
  });
}

const MOVE_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
];

/** Whether this key moves the selection around the grid. */
export const isMoveKey = (key: string) => MOVE_KEYS.includes(key);

/**
 * The cell selected after a navigation key, or null when the key is not one. Arrows stop at the
 * edges; Home and End go to the ends of the row, PageUp and PageDown to the ends of the column.
 * With nothing selected, any of them lands on the first cell.
 */
export function moveSelection(current: number | null, key: string, size: number) {
  if (!isMoveKey(key)) return null;
  if (current === null) return 0;
  const row = Math.floor(current / size);
  const col = current % size;
  const last = size - 1;
  const [nextRow, nextCol] = {
    ArrowUp: [Math.max(0, row - 1), col],
    ArrowDown: [Math.min(last, row + 1), col],
    ArrowLeft: [row, Math.max(0, col - 1)],
    ArrowRight: [row, Math.min(last, col + 1)],
    Home: [row, 0],
    End: [row, last],
    PageUp: [0, col],
    PageDown: [last, col],
  }[key]!;
  return nextRow * size + nextCol;
}

/** Where a cell is, in words: "ligne 3, colonne 4". */
export const cellPlace = (index: number, size: number, t: Translate = tFr) =>
  t("place", { row: Math.floor(index / size) + 1, col: (index % size) + 1 });

/** What a screen reader says once the judge has answered about a digit. */
export function verdictAnnouncement(
  entry: {
    correct: boolean;
    number: number;
    index: number;
    size: number;
    mistakes: number;
  },
  t: Translate = tFr,
) {
  const place = cellPlace(entry.index, entry.size, t);
  if (entry.correct) return t("say.correct", { n: entry.number, place });
  const lives = Math.max(0, MAX_MISTAKES - entry.mistakes);
  return lives
    ? t("say.wrong", { n: entry.number, place, count: lives })
    : t("say.lost", { n: entry.number, place });
}
