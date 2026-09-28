// Rates a puzzle by the hardest human technique needed to solve it, from the easiest:
// naked singles, hidden singles, locked candidates, pairs, then triples and X-wings.

export const Technique = {
  NakedSingle: 1,
  HiddenSingle: 2,
  LockedCandidates: 3,
  Pairs: 4,
  TriplesAndXWing: 5,
} as const;
export type TechniqueLevel = (typeof Technique)[keyof typeof Technique];

const ALL = 0x1ff;
const bit = (digit: number) => 1 << (digit - 1);
const count = (mask: number) => {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
};
const digitsOf = (mask: number) => {
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) digits.push(d);
  return digits;
};

const rows = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c));
const columns = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c));
const boxes = Array.from({ length: 9 }, (_, b) =>
  Array.from(
    { length: 9 },
    (_, i) => (Math.floor(b / 3) * 3 + Math.floor(i / 3)) * 9 + (b % 3) * 3 + (i % 3),
  ),
);
const units = [...rows, ...columns, ...boxes];
const boxOf = (cell: number) =>
  Math.floor(Math.floor(cell / 9) / 3) * 3 + Math.floor((cell % 9) / 3);
const peers = Array.from({ length: 81 }, (_, cell) => {
  const set = new Set([...rows[Math.floor(cell / 9)], ...columns[cell % 9], ...boxes[boxOf(cell)]]);
  set.delete(cell);
  return [...set];
});

class Board {
  values: number[];
  candidates: number[];
  constructor(puzzle: readonly number[]) {
    this.values = Array(81).fill(0);
    this.candidates = Array(81).fill(ALL);
    puzzle.forEach((value, cell) => value && this.place(cell, value));
  }
  place(cell: number, digit: number) {
    this.values[cell] = digit;
    this.candidates[cell] = 0;
    for (const peer of peers[cell]) this.candidates[peer] &= ~bit(digit);
  }
  eliminate(cells: Iterable<number>, mask: number) {
    let changed = false;
    for (const cell of cells) {
      if (this.values[cell] || !(this.candidates[cell] & mask)) continue;
      this.candidates[cell] &= ~mask;
      changed = true;
    }
    return changed;
  }
  get solved() {
    return this.values.every(Boolean);
  }
  get stuck() {
    return this.values.some((value, cell) => !value && !this.candidates[cell]);
  }
}

function nakedSingle(board: Board) {
  for (let cell = 0; cell < 81; cell++) {
    const mask = board.candidates[cell];
    if (!board.values[cell] && count(mask) === 1) {
      board.place(cell, digitsOf(mask)[0]);
      return true;
    }
  }
  return false;
}

function hiddenSingle(board: Board) {
  for (const unit of units) {
    for (let digit = 1; digit <= 9; digit++) {
      const spots = unit.filter((cell) => board.candidates[cell] & bit(digit));
      if (spots.length === 1) {
        board.place(spots[0], digit);
        return true;
      }
    }
  }
  return false;
}

function lockedCandidates(board: Board) {
  for (const box of boxes) {
    for (let digit = 1; digit <= 9; digit++) {
      const spots = box.filter((cell) => board.candidates[cell] & bit(digit));
      if (spots.length < 2) continue;
      const row = Math.floor(spots[0] / 9),
        column = spots[0] % 9;
      if (spots.every((cell) => Math.floor(cell / 9) === row)) {
        if (
          board.eliminate(
            rows[row].filter((cell) => !box.includes(cell)),
            bit(digit),
          )
        )
          return true;
      }
      if (spots.every((cell) => cell % 9 === column)) {
        if (
          board.eliminate(
            columns[column].filter((cell) => !box.includes(cell)),
            bit(digit),
          )
        )
          return true;
      }
    }
  }
  for (const line of [...rows, ...columns]) {
    for (let digit = 1; digit <= 9; digit++) {
      const spots = line.filter((cell) => board.candidates[cell] & bit(digit));
      if (spots.length < 2) continue;
      const box = boxOf(spots[0]);
      if (spots.every((cell) => boxOf(cell) === box)) {
        if (
          board.eliminate(
            boxes[box].filter((cell) => !line.includes(cell)),
            bit(digit),
          )
        )
          return true;
      }
    }
  }
  return false;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]),
  );
}

// Naked subsets: `size` cells sharing `size` candidates. Hidden subsets: `size` digits
// confined to `size` cells.
function subsets(board: Board, size: number) {
  for (const unit of units) {
    const open = unit.filter((cell) => !board.values[cell]);
    for (const group of combinations(open, size)) {
      const mask = group.reduce((acc, cell) => acc | board.candidates[cell], 0);
      if (
        count(mask) === size &&
        board.eliminate(
          open.filter((cell) => !group.includes(cell)),
          mask,
        )
      )
        return true;
    }
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) =>
      open.some((cell) => board.candidates[cell] & bit(digit)),
    );
    for (const group of combinations(digits, size)) {
      const mask = group.reduce((acc, digit) => acc | bit(digit), 0);
      const cells = open.filter((cell) => board.candidates[cell] & mask);
      if (cells.length !== size) continue;
      if (!group.every((digit) => cells.some((cell) => board.candidates[cell] & bit(digit))))
        continue;
      let changed = false;
      for (const cell of cells) {
        if (board.candidates[cell] & ~mask) {
          board.candidates[cell] &= mask;
          changed = true;
        }
      }
      if (changed) return true;
    }
  }
  return false;
}

function xWing(board: Board) {
  for (const [lines, crossLines, position] of [
    [rows, columns, (cell: number) => cell % 9],
    [columns, rows, (cell: number) => Math.floor(cell / 9)],
  ] as const) {
    for (let digit = 1; digit <= 9; digit++) {
      const pairs = lines
        .map((line) => line.filter((cell) => board.candidates[cell] & bit(digit)).map(position))
        .map((spots, index) => ({ index, spots }))
        .filter(({ spots }) => spots.length === 2);
      for (const [a, b] of combinations(pairs, 2)) {
        if (a.spots[0] !== b.spots[0] || a.spots[1] !== b.spots[1]) continue;
        const targets = a.spots.flatMap((spot) =>
          crossLines[spot].filter((cell) => {
            const line = lines === rows ? Math.floor(cell / 9) : cell % 9;
            return line !== a.index && line !== b.index;
          }),
        );
        if (board.eliminate(targets, bit(digit))) return true;
      }
    }
  }
  return false;
}

const steps: [TechniqueLevel, (board: Board) => boolean][] = [
  [Technique.NakedSingle, nakedSingle],
  [Technique.HiddenSingle, hiddenSingle],
  [Technique.LockedCandidates, lockedCandidates],
  [Technique.Pairs, (board) => subsets(board, 2)],
  [Technique.TriplesAndXWing, (board) => subsets(board, 3) || xWing(board)],
];

/**
 * Solves the puzzle with the techniques above only. Returns the hardest one used and the
 * resulting grid, or null when they are not enough (chains or trial and error needed).
 */
export function solveLogically(puzzle: readonly number[]) {
  const board = new Board(puzzle);
  let hardest: TechniqueLevel = Technique.NakedSingle;
  while (!board.solved) {
    if (board.stuck) return null;
    const step = steps.find(([, apply]) => apply(board));
    if (!step) return null;
    if (step[0] > hardest) hardest = step[0];
  }
  return { level: hardest, grid: board.values };
}

/** Hardest technique needed to solve the puzzle, or null when they are not enough. */
export function gradePuzzle(puzzle: readonly number[]): TechniqueLevel | null {
  return solveLogically(puzzle)?.level ?? null;
}

/** Row, column or box (numbered from 1) that forces a hidden single. */
export type HintUnit = { kind: "row" | "column" | "box"; number: number; cells: number[] };

/** The next digit a player can deduce, and how. */
export type LogicalStep = {
  index: number;
  digit: number;
  /** NakedSingle: the only candidate of its cell. HiddenSingle: the only place in `unit`. */
  technique: typeof Technique.NakedSingle | typeof Technique.HiddenSingle;
  unit?: HintUnit;
  /** Hardest elimination technique needed before the single shows up, if any. */
  eliminatedWith?: TechniqueLevel;
};

const unitOrder = [...Array(27).keys()].map((i) => (i + 18) % 27);
const unitOf = (index: number): HintUnit => {
  const kind = index < 9 ? "row" : index < 18 ? "column" : "box";
  return { kind, number: (index % 9) + 1, cells: units[index] };
};

/**
 * Next cell a human can fill by logic from `grid` (0 for empty), trying the easiest
 * techniques first. `grid` must only hold correct digits. Null when the techniques above
 * are not enough.
 */
export function nextLogicalStep(grid: readonly number[]): LogicalStep | null {
  const board = new Board(grid);
  let eliminatedWith: TechniqueLevel | undefined;
  while (!board.solved && !board.stuck) {
    const extra = eliminatedWith ? { eliminatedWith } : {};
    for (let cell = 0; cell < 81; cell++) {
      const mask = board.candidates[cell];
      if (!board.values[cell] && count(mask) === 1)
        return {
          index: cell,
          digit: digitsOf(mask)[0],
          technique: Technique.NakedSingle,
          ...extra,
        };
    }
    // Boxes first: that is where most players look for a hidden single.
    for (const u of unitOrder) {
      const unit = units[u];
      for (let digit = 1; digit <= 9; digit++) {
        const spots = unit.filter((cell) => board.candidates[cell] & bit(digit));
        if (spots.length === 1)
          return {
            index: spots[0],
            digit,
            technique: Technique.HiddenSingle,
            unit: unitOf(u),
            ...extra,
          };
      }
    }
    const step = steps.slice(2).find(([, apply]) => apply(board));
    if (!step) return null;
    if (!eliminatedWith || step[0] > eliminatedWith) eliminatedWith = step[0];
  }
  return null;
}
