// Solver for the variants of lib/variants.ts: it counts solutions (up to a limit) and finds
// one. Used offline to build the bank and in tests; the server never solves at request time.
import { cellCount, peerTable, type Geometry } from "./variants";

const bit = (digit: number) => 1 << (digit - 1);

type Options = {
  /** Stop counting after this many solutions. */
  limit?: number;
  /** Tries the digits of each cell in this order, to draw random solutions. */
  random?: () => number;
};

/** Number of solutions of `puzzle` (0 = empty cell) under `geometry`, up to `limit`. */
export function solveVariant(geometry: Geometry, puzzle: readonly number[], options: Options = {}) {
  const { size } = geometry;
  const limit = options.limit ?? 2;
  const all = (1 << size) - 1;
  const total = cellCount(geometry);
  const peers = peerTable(geometry);
  const grid = [...puzzle];
  const cageOf = new Array<number>(total).fill(-1);
  geometry.cages.forEach((cage, k) => cage.cells.forEach((cell) => (cageOf[cell] = k)));

  // A cage stays possible while the digits still to place can reach its remaining sum.
  const cageFeasible = (k: number) => {
    const cage = geometry.cages[k];
    let placed = 0;
    let used = 0;
    let open = 0;
    for (const cell of cage.cells) {
      if (grid[cell]) {
        placed += grid[cell];
        used |= bit(grid[cell]);
      } else open++;
    }
    const remaining = cage.sum - placed;
    if (open === 0) return remaining === 0;
    if (remaining <= 0) return false;
    const free: number[] = [];
    for (let d = 1; d <= size; d++) if (!(used & bit(d))) free.push(d);
    if (free.length < open) return false;
    let low = 0;
    let high = 0;
    for (let i = 0; i < open; i++) {
      low += free[i];
      high += free[free.length - 1 - i];
    }
    return remaining >= low && remaining <= high;
  };

  for (let k = 0; k < geometry.cages.length; k++) if (!cageFeasible(k)) return { count: 0 };
  for (let cell = 0; cell < total; cell++) {
    const digit = grid[cell];
    if (digit && peers[cell].some((peer) => grid[peer] === digit)) return { count: 0 };
  }

  let count = 0;
  let first: number[] | null = null;
  const search = () => {
    if (count >= limit) return;
    // The empty cell with the fewest candidates.
    let bestCell = -1;
    let bestMask = 0;
    let bestSize = size + 1;
    for (let cell = 0; cell < total; cell++) {
      if (grid[cell]) continue;
      let mask = all;
      for (const peer of peers[cell]) if (grid[peer]) mask &= ~bit(grid[peer]);
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n === 0) return;
      if (n < bestSize) {
        bestCell = cell;
        bestMask = mask;
        bestSize = n;
        if (n === 1) break;
      }
    }
    if (bestCell < 0) {
      count++;
      first ??= [...grid];
      return;
    }
    const digits: number[] = [];
    for (let d = 1; d <= size; d++) if (bestMask & bit(d)) digits.push(d);
    if (options.random)
      for (let i = digits.length - 1; i > 0; i--) {
        const j = Math.floor(options.random() * (i + 1));
        [digits[i], digits[j]] = [digits[j], digits[i]];
      }
    for (const digit of digits) {
      grid[bestCell] = digit;
      if (cageOf[bestCell] < 0 || cageFeasible(cageOf[bestCell])) search();
      grid[bestCell] = 0;
      if (count >= limit) return;
    }
  };
  search();
  return { count, solution: first as number[] | null };
}

/** True when the puzzle has exactly one solution. */
export const hasUniqueVariantSolution = (geometry: Geometry, puzzle: readonly number[]) =>
  solveVariant(geometry, puzzle, { limit: 2 }).count === 1;
