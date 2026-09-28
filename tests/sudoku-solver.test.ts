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
});
