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

export function isCellIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < 81;
}

export function isDigit(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 9;
}

/** An 81-cell grid of digits (0 = empty) that keeps every given of `puzzle`. */
export function isGridOf(puzzle: string, grid: unknown): grid is number[] {
  return (
    Array.isArray(grid) &&
    grid.length === 81 &&
    grid.every(
      (value, i) =>
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 9 &&
        (puzzle[i] === "0" || value === Number(puzzle[i])),
    )
  );
}

/** True when `grid` is exactly the solution string. */
export function matchesSolution(solution: string, grid: unknown) {
  return (
    Array.isArray(grid) &&
    grid.length === 81 &&
    grid.every((value, i) => value === Number(solution[i]))
  );
}
