/** A digit the player placed, with an id so retries are not counted twice. */
export type Entry = { index: number; number: number; id: string };
/** Verdict on an entry; `mistakes` is the authoritative count when the server keeps it. */
export type Verdict = { correct: boolean; mistakes?: number };

/** Decides whether entries are correct. The board never needs the solution itself. */
export type Judge = {
  check: (entry: Entry, grid: number[]) => Promise<Verdict>;
  /** Reveals a digit, in `preferred` cell when it still needs one. */
  hint?: (grid: number[], preferred?: number) => Promise<{ index: number; number: number } | null>;
};

/** Judge for games whose solution the browser already knows (guest solo, private rooms). */
export function localJudge(puzzle: readonly number[], solution: readonly number[]): Judge {
  return {
    check: async ({ index, number }) => ({ correct: solution[index] === number }),
    hint: async (grid, preferred) => {
      const needs = (i: number) => !puzzle[i] && grid[i] !== solution[i];
      const index =
        preferred !== undefined && needs(preferred)
          ? preferred
          : grid.findIndex((_, i) => needs(i));
      return index < 0 ? null : { index, number: solution[index] };
    },
  };
}
