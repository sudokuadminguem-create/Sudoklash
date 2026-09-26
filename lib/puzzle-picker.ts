import type { Difficulty } from "@/lib/difficulties";
import { puzzleBank } from "@/lib/puzzle-bank";
import { solvePuzzle } from "@/lib/sudoku-solver";
import { makeSudokuVariant } from "@/lib/sudoku-variants";

/** A bank puzzle of the given difficulty, shuffled by symmetry so repeats look different. */
export function pickPuzzle(difficulty: Difficulty, random: () => number = Math.random) {
  const bank = puzzleBank[difficulty];
  const base = bank[Math.floor(random() * bank.length)];
  const solution = solvePuzzle(base);
  if (!solution) throw new Error(`invalid_bank_puzzle:${difficulty}`);
  const variant = makeSudokuVariant(base.split("").map(Number), solution);
  return { puzzle: variant.puzzle.join(""), solution: variant.solution.join("") };
}

/** The bank puzzle assigned to a period, the same for every player. */
export function puzzleForPeriod(difficulty: Difficulty, key: string) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const bank = puzzleBank[difficulty];
  return bank[hash % bank.length];
}
