import { describe, expect, it } from "vitest";
import { hasUniqueSolution, solvePuzzle } from "@/lib/sudoku-solver";

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const solution =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("sudoku solver", () => {
  it("solves a valid puzzle", () => {
    expect(solvePuzzle(puzzle)?.join("")).toBe(solution);
  });
  it("rejects malformed input", () => {
    expect(solvePuzzle("12")).toBeNull();
    expect(hasUniqueSolution("x".repeat(81))).toBe(false);
  });
  it("detects multiple solutions", () => {
    expect(hasUniqueSolution(puzzle)).toBe(true);
    expect(hasUniqueSolution("0".repeat(81))).toBe(false);
  });
  it("rejects grids whose given digits clash", () => {
    expect(solvePuzzle("1".repeat(81))).toBeNull();
    expect(hasUniqueSolution("1".repeat(81))).toBe(false);
    // Two 5s in the first row of an otherwise valid puzzle.
    const clash = "55" + puzzle.slice(2);
    expect(solvePuzzle(clash)).toBeNull();
    expect(hasUniqueSolution(clash)).toBe(false);
    // A completed grid is accepted only when it is a valid solution.
    expect(solvePuzzle(solution)?.join("")).toBe(solution);
    expect(solvePuzzle("2" + solution.slice(1))).toBeNull();
  });
});
