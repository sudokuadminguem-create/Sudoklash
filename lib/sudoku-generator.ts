import type { Difficulty } from "@/lib/difficulties";
import { gradePuzzle, Technique, type TechniqueLevel } from "@/lib/sudoku-grader";
import { hasUniqueSolution } from "@/lib/sudoku-solver";

export type Random = () => number;

/** Small seeded generator (mulberry32), so a puzzle bank can be rebuilt identically. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], random: Random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** A random complete, valid grid. */
export function randomSolution(random: Random): number[] {
  const grid = Array(81).fill(0);
  const fits = (cell: number, digit: number) => {
    const row = Math.floor(cell / 9),
      column = cell % 9;
    for (let i = 0; i < 9; i++)
      if (grid[row * 9 + i] === digit || grid[i * 9 + column] === digit) return false;
    const boxRow = row - (row % 3),
      boxColumn = column - (column % 3);
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++)
        if (grid[(boxRow + y) * 9 + boxColumn + x] === digit) return false;
    return true;
  };
  const fill = (cell: number): boolean => {
    if (cell === 81) return true;
    for (const digit of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
      if (!fits(cell, digit)) continue;
      grid[cell] = digit;
      if (fill(cell + 1)) return true;
    }
    grid[cell] = 0;
    return false;
  };
  fill(0);
  return grid;
}

/** Removes clues in random order while the solution stays unique, down to `minClues`. */
export function carvePuzzle(solution: readonly number[], minClues: number, random: Random) {
  const puzzle = [...solution];
  let clues = 81;
  for (const cell of shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    random,
  )) {
    if (clues <= minClues) break;
    const value = puzzle[cell];
    puzzle[cell] = 0;
    if (hasUniqueSolution(puzzle.join(""))) clues--;
    else puzzle[cell] = value;
  }
  return puzzle;
}

type Profile = { clues: [number, number]; techniques: (TechniqueLevel | null)[] };

/** What each solo difficulty means: clue count range and the techniques it requires. */
export const difficultyProfiles: Record<Difficulty, Profile> = {
  Débutant: { clues: [40, 46], techniques: [Technique.NakedSingle] },
  Facile: { clues: [32, 38], techniques: [Technique.NakedSingle, Technique.HiddenSingle] },
  Intermédiaire: { clues: [26, 34], techniques: [Technique.LockedCandidates] },
  Difficile: { clues: [22, 32], techniques: [Technique.Pairs] },
  Expert: { clues: [20, 30], techniques: [Technique.TriplesAndXWing] },
  Maître: { clues: [17, 28], techniques: [null] },
};

/** Difficulty matching a puzzle, or null when it fits none of the profiles. */
export function classifyPuzzle(puzzle: readonly number[]): Difficulty | null {
  const clues = puzzle.filter(Boolean).length;
  const level = gradePuzzle(puzzle);
  for (const [difficulty, profile] of Object.entries(difficultyProfiles) as [
    Difficulty,
    Profile,
  ][]) {
    if (
      clues >= profile.clues[0] &&
      clues <= profile.clues[1] &&
      profile.techniques.includes(level)
    )
      return difficulty;
  }
  return null;
}
