/** A digit the player placed, with an id so retries are not counted twice. */
export type Entry = { index: number; number: number; id: string };
/** Verdict on an entry; `mistakes` is the authoritative count when the server keeps it. */
export type Verdict = { correct: boolean; mistakes?: number };

/** Decides whether entries are correct. The board never needs the solution itself. */
export type Judge = {
  check: (entry: Entry, grid: number[]) => Promise<Verdict>;
  hint?: (grid: number[]) => Promise<{ index: number; number: number } | null>;
};

/** Judge for games whose solution the browser already knows (guest solo, private rooms). */
export function localJudge(puzzle: readonly number[], solution: readonly number[]): Judge {
  return {
    check: async ({ index, number }) => ({ correct: solution[index] === number }),
    hint: async (grid) => {
      const index = grid.findIndex((value, i) => !puzzle[i] && value !== solution[i]);
      return index < 0 ? null : { index, number: solution[index] };
    },
  };
}
