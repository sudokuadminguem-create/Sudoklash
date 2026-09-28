import { describe, expect, it } from "vitest";
import { hintText } from "@/app/lib/hint-text";
import { nextLogicalStep, Technique } from "@/lib/sudoku-grader";
import { solveGrid } from "@/lib/sudoku-solver";

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
  .split("")
  .map(Number);
const solution = solveGrid(puzzle)!;

describe("logical hints", () => {
  it("points to a cell that can be deduced, with the right digit", () => {
    const step = nextLogicalStep(puzzle)!;
    expect(puzzle[step.index]).toBe(0);
    expect(step.digit).toBe(solution[step.index]);
  });

  it("leads to the solution when followed step by step", () => {
    const grid = [...puzzle];
    while (grid.some((v) => !v)) {
      const step = nextLogicalStep(grid);
      expect(step).not.toBeNull();
      expect(step!.digit).toBe(solution[step!.index]);
      grid[step!.index] = step!.digit;
    }
  });

  it("describes where to look", () => {
    const step = nextLogicalStep(puzzle)!;
    const { text } = hintText(step.index, step);
    expect(text).toContain(`ligne ${Math.floor(step.index / 9) + 1}`);
    expect(text).toContain(`colonne ${(step.index % 9) + 1}`);
    if (step.technique === Technique.HiddenSingle) expect(step.unit!.cells).toContain(step.index);
  });

  it("explains without the digit when logic is not enough", () => {
    expect(hintText(40, null).text).toContain("ligne 5, colonne 5");
  });
});
