// Builds puzzles for the variants of lib/variants.ts. Offline tool: scripts/generate-variant-bank.ts
// runs it and writes lib/variant-bank.ts, which is what the game serves.
import { solveVariant } from "./variant-solver";
import { cellCount, type Cage, type Geometry } from "./variants";

type Random = () => number;

function shuffled<T>(values: readonly T[], random: Random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** A complete valid grid under the geometry's rules (cages excluded: they come afterwards). */
export function randomVariantSolution(geometry: Geometry, random: Random) {
  const bare: Geometry = { ...geometry, cages: [] };
  const found = solveVariant(bare, Array(cellCount(bare)).fill(0), { limit: 1, random });
  if (!found.solution) throw new Error("no_solution");
  return found.solution;
}

/**
 * Splits the grid into cages of two to four orthogonally touching cells that hold different
 * digits, each with the sum of its digits. Cells left over become one-cell cages only when
 * nothing else fits, which gives their digit away.
 */
export function makeCages(size: number, solution: readonly number[], random: Random): Cage[] {
  const cageOf = new Array<number>(size * size).fill(-1);
  const cages: Cage[] = [];
  const neighbours = (cell: number) => {
    const [r, c] = [Math.floor(cell / size), cell % size];
    return [
      r > 0 ? cell - size : -1,
      r < size - 1 ? cell + size : -1,
      c > 0 ? cell - 1 : -1,
      c < size - 1 ? cell + 1 : -1,
    ].filter((n) => n >= 0);
  };
  for (const start of shuffled([...Array(size * size).keys()], random)) {
    if (cageOf[start] >= 0) continue;
    const wanted = 2 + Math.floor(random() * 3);
    const cells = [start];
    cageOf[start] = cages.length;
    while (cells.length < wanted) {
      const options = cells
        .flatMap(neighbours)
        .filter((n) => cageOf[n] < 0 && !cells.some((cell) => solution[cell] === solution[n]));
      if (!options.length) break;
      const next = options[Math.floor(random() * options.length)];
      cells.push(next);
      cageOf[next] = cages.length;
    }
    cages.push({
      cells: cells.sort((a, b) => a - b),
      sum: cells.reduce((s, c) => s + solution[c], 0),
    });
  }
  return cages;
}

/**
 * Removes clues from a full grid while the solution stays unique, until about `clues` remain
 * (or none can go). Cells are tried in random order.
 */
export function carveVariant(
  geometry: Geometry,
  solution: readonly number[],
  clues: number,
  random: Random,
) {
  const puzzle = [...solution];
  let left = puzzle.length;
  for (const cell of shuffled([...puzzle.keys()], random)) {
    if (left <= clues) break;
    const digit = puzzle[cell];
    puzzle[cell] = 0;
    if (solveVariant(geometry, puzzle, { limit: 2 }).count === 1) left--;
    else puzzle[cell] = digit;
  }
  return puzzle;
}
