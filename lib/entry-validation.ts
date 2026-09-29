// Checks on what players send about a grid.

export const MAX_MISTAKES = 3;

/** Client-generated id of an entry, so a retried request is not counted twice. */
export function isEntryId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
}

/**
 * What identifies one wrong guess: the client id alone would let a player retry a cell with
 * every digit under the same id and be charged for a single mistake.
 */
export function mistakeKey(id: string, index: number, number: number) {
  return `${id}:${index}:${number}`;
}

/** A cell of a grid with `cells` cells (81 for the classic grid). */
export function isCellIndex(value: unknown, cells = 81): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < cells;
}

/** A digit of a grid of side `size` (9 for the classic grid). */
export function isDigit(value: unknown, size = 9): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= size;
}

/** A grid of the puzzle's size, digits 0 (empty) to its side, keeping every given of `puzzle`. */
export function isGridOf(puzzle: string, grid: unknown): grid is number[] {
  const size = Math.round(Math.sqrt(puzzle.length));
  return (
    Array.isArray(grid) &&
    grid.length === puzzle.length &&
    grid.every(
      (value, i) =>
        Number.isInteger(value) &&
        value >= 0 &&
        value <= size &&
        (puzzle[i] === "0" || value === Number(puzzle[i])),
    )
  );
}

/** True when `grid` is exactly the solution string. */
export function matchesSolution(solution: string, grid: unknown) {
  return (
    Array.isArray(grid) &&
    grid.length === solution.length &&
    grid.every((value, i) => value === Number(solution[i]))
  );
}
