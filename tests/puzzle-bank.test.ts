import { describe, expect, it } from "vitest";
import { soloDifficulties } from "@/lib/difficulties";
import { pickPuzzle, puzzleForPeriod } from "@/lib/puzzle-picker";
import { puzzleBank } from "@/lib/puzzle-bank";
import { classifyPuzzle } from "@/lib/sudoku-generator";
import { hasUniqueSolution, solvePuzzle } from "@/lib/sudoku-solver";

describe("puzzle bank", () => {
  it.each(soloDifficulties)("holds distinct, unique, correctly rated %s puzzles", (difficulty) => {
    const puzzles = puzzleBank[difficulty];
    expect(puzzles.length).toBeGreaterThanOrEqual(50);
    expect(new Set(puzzles).size).toBe(puzzles.length);
    for (const puzzle of puzzles) {
      expect(hasUniqueSolution(puzzle)).toBe(true);
      expect(classifyPuzzle(puzzle.split("").map(Number))).toBe(difficulty);
    }
  });

  it("picks shuffled puzzles with their solution", () => {
    const { puzzle, solution } = pickPuzzle("Expert");
    expect(solvePuzzle(puzzle)?.join("")).toBe(solution);
  });

  it("assigns a stable puzzle per period", () => {
    expect(puzzleForPeriod("Facile", "daily:2026-09-26")).toBe(
      puzzleForPeriod("Facile", "daily:2026-09-26"),
    );
    const week = new Set(
      ["20", "21", "22", "23", "24", "25", "26"].map((d) =>
        puzzleForPeriod("Facile", `daily:2026-09-${d}`),
      ),
    );
    expect(week.size).toBeGreaterThan(4);
  });
});
