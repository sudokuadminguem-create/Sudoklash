// Pure Sudoku helpers shared by the browser and the Worker. Grids are 81 cells, 0 = empty.

const GRID_PATTERN = /^[0-9]{81}$/;

function canPlace(grid: readonly number[], position: number, value: number) {
  const row = Math.floor(position / 9),
    column = position % 9;
  for (let index = 0; index < 9; index++) {
    if (grid[row * 9 + index] === value || grid[index * 9 + column] === value) return false;
  }
  const blockRow = Math.floor(row / 3) * 3,
    blockColumn = Math.floor(column / 3) * 3;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (grid[(blockRow + y) * 9 + blockColumn + x] === value) return false;
    }
  }
  return true;
}

/** False when two given digits already clash in a row, column or block. */
function givensAreConsistent(grid: number[]) {
  for (let index = 0; index < 81; index++) {
    const value = grid[index];
    if (!value) continue;
    grid[index] = 0;
    const fits = canPlace(grid, index, value);
    grid[index] = value;
    if (!fits) return false;
  }
  return true;
}

type NextCell =
  | { kind: "solved" }
  | { kind: "dead_end" }
  | { kind: "branch"; position: number; options: number[] };

// Picks the empty cell with the fewest candidates, stopping early on a forced cell.
function nextCell(grid: readonly number[]): NextCell {
  let position = -1,
    options: number[] = [];
  for (let index = 0; index < 81; index++) {
    if (grid[index]) continue;
    const candidates = [];
    for (let value = 1; value <= 9; value++)
      if (canPlace(grid, index, value)) candidates.push(value);
    if (!candidates.length) return { kind: "dead_end" };
    if (position < 0 || candidates.length < options.length) {
      position = index;
      options = candidates;
      if (candidates.length === 1) break;
    }
  }
  return position < 0 ? { kind: "solved" } : { kind: "branch", position, options };
}

/** Returns the first solution found for `source`, or null when it has none. */
export function solveGrid(source: readonly number[]): number[] | null {
  const grid = [...source];
  if (!givensAreConsistent(grid)) return null;
  const solve = (): boolean => {
    const next = nextCell(grid);
    if (next.kind !== "branch") return next.kind === "solved";
    for (const value of next.options) {
      grid[next.position] = value;
      if (solve()) return true;
      grid[next.position] = 0;
    }
    return false;
  };
  return solve() ? grid : null;
}

/** Solves an 81-digit puzzle string. Returns null for malformed or unsolvable input. */
export function solvePuzzle(value: string): number[] | null {
  if (!GRID_PATTERN.test(value)) return null;
  return solveGrid(value.split("").map(Number));
}

/** True when the 81-digit puzzle string has exactly one solution. */
export function hasUniqueSolution(value: string): boolean {
  if (!GRID_PATTERN.test(value)) return false;
  const grid = value.split("").map(Number);
  if (!givensAreConsistent(grid)) return false;
  let solutions = 0;
  const search = () => {
    if (solutions > 1) return;
    const next = nextCell(grid);
    if (next.kind === "dead_end") return;
    if (next.kind === "solved") {
      solutions++;
      return;
    }
    for (const value of next.options) {
      grid[next.position] = value;
      search();
      grid[next.position] = 0;
    }
  };
  search();
  return solutions === 1;
}
