import { describe, expect, it } from "vitest";
import { carvePuzzle, classifyPuzzle, randomSolution, seededRandom } from "@/lib/sudoku-generator";
import { gradePuzzle, solveLogically, Technique } from "@/lib/sudoku-grader";
import { hasUniqueSolution, solveGrid } from "@/lib/sudoku-solver";

const toGrid = (value: string) => value.split("").map(Number);

describe("sudoku generator", () => {
  it("builds valid complete grids", () => {
    const grid = randomSolution(seededRandom(1));
    expect(grid.every((value) => value >= 1 && value <= 9)).toBe(true);
    expect(solveGrid(grid)).toEqual(grid);
  });

  it("carves puzzles with a unique solution", () => {
    const random = seededRandom(2);
    const solution = randomSolution(random);
    const puzzle = carvePuzzle(solution, 30, random);
    expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(30);
    expect(hasUniqueSolution(puzzle.join(""))).toBe(true);
    expect(solveGrid(puzzle)).toEqual(solution);
  });

  it("is reproducible from a seed", () => {
    expect(randomSolution(seededRandom(7))).toEqual(randomSolution(seededRandom(7)));
  });
});

describe("difficulty grader", () => {
  it("rates a puzzle solved by singles as easy", () => {
    const easy = toGrid(
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    );
    expect(gradePuzzle(easy)).toBeLessThanOrEqual(Technique.HiddenSingle);
  });

  it("reports puzzles beyond the known techniques", () => {
    // "Platinum Blonde", a famously hard puzzle.
    const hard = toGrid(
      "000000012000000003002300400001800005060070800000009000008500000900040500470006000",
    );
    expect(gradePuzzle(hard)).toBeNull();
  });

  it("keeps the solution intact while grading", () => {
    const puzzle = carvePuzzle(randomSolution(seededRandom(3)), 24, seededRandom(4));
    const before = puzzle.join("");
    gradePuzzle(puzzle);
    expect(puzzle.join("")).toBe(before);
    expect(classifyPuzzle(toGrid("0".repeat(81)))).toBeNull();
  });

  it("only makes correct deductions", () => {
    const random = seededRandom(5);
    const seen = new Set<number | null>();
    for (let i = 0; i < 150; i++) {
      const solution = randomSolution(random);
      const puzzle = carvePuzzle(solution, 20 + Math.floor(random() * 26), random);
      const result = solveLogically(puzzle);
      seen.add(result?.level ?? null);
      if (result) expect(result.grid).toEqual(solution);
    }
    // The sample should exercise several techniques, not just singles.
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
