import { describe, expect, it } from "vitest";
import { variantBank } from "@/lib/variant-bank";
import { carveVariant, makeCages, randomVariantSolution } from "@/lib/variant-generator";
import { pickVariantGame } from "@/lib/variant-picker";
import { hasUniqueVariantSolution, solveVariant } from "@/lib/variant-solver";
import { seededRandom } from "@/lib/sudoku-generator";
import {
  areRelated,
  cagesFromText,
  cagesToText,
  CLASSIC,
  diagonalCells,
  distinctUnits,
  geometryOf,
  peerTable,
  sizeOfCells,
  validCages,
  variantByLabel,
  variantIds,
  variantInfo,
} from "@/lib/variants";

const toGrid = (text: string) => text.split("").map(Number);

describe("geometry", () => {
  it("describes the classic grid, the mini grid and the diagonals", () => {
    expect(distinctUnits(CLASSIC)).toHaveLength(27);
    const mini = geometryOf("mini");
    expect(mini.size).toBe(6);
    expect(distinctUnits(mini)).toHaveLength(18); // 6 rows, 6 columns, 6 boxes of 2×3
    expect(distinctUnits(geometryOf("diagonal"))).toHaveLength(29);
    expect(diagonalCells(4)).toEqual([
      [0, 5, 10, 15],
      [3, 6, 9, 12],
    ]);
  });

  it("finds the peers of a cell", () => {
    expect(peerTable(CLASSIC)[0]).toHaveLength(20);
    expect(peerTable(geometryOf("mini"))[0]).toHaveLength(5 + 5 + 2); // row, column, box
    // On a diagonal, a cell also shares a zone with the rest of the diagonal.
    expect(peerTable(geometryOf("diagonal"))[0]).toHaveLength(20 + 6);
  });

  it("tells related cells apart with and without extra zones", () => {
    expect(areRelated(CLASSIC, 0, 8)).toBe(true);
    expect(areRelated(CLASSIC, 0, 40)).toBe(false);
    expect(areRelated(geometryOf("diagonal"), 0, 40)).toBe(true); // both on the diagonal
    const caged = geometryOf("killer", [{ cells: [0, 40], sum: 9 }]);
    expect(areRelated(caged, 0, 40)).toBe(true);
    expect(areRelated(caged, 0, 41)).toBe(false);
    // 6×6 boxes are two rows by three columns.
    const mini = geometryOf("mini");
    expect(areRelated(mini, 0, 8)).toBe(true); // same box (row 0, column 2 and row 1, column 2)
    expect(areRelated(mini, 0, 14)).toBe(false);
  });

  it("reads square sizes, labels and cages", () => {
    expect(sizeOfCells(81)).toBe(9);
    expect(sizeOfCells(36)).toBe(6);
    expect(sizeOfCells(50)).toBeNull();
    expect(variantByLabel("Killer")).toBe("killer");
    expect(variantByLabel("Facile")).toBeUndefined();
    const cages = [
      { cells: [0, 1, 9], sum: 14 },
      { cells: [2], sum: 5 },
    ];
    expect(cagesFromText(cagesToText(cages))).toEqual(cages);
    expect(cagesFromText("")).toEqual([]);
  });

  it("rejects malformed cages", () => {
    expect(validCages([{ cells: [0, 1], sum: 5 }], 9)).toBe(true);
    expect(validCages("no", 9)).toBe(false);
    expect(validCages([{ cells: [0, 0], sum: 5 }], 9)).toBe(false); // repeated cell
    expect(
      validCages(
        [
          { cells: [0], sum: 5 },
          { cells: [0], sum: 4 },
        ],
        9,
      ),
    ).toBe(false); // overlap
    expect(validCages([{ cells: [81], sum: 5 }], 9)).toBe(false);
    expect(validCages([{ cells: [0], sum: 1.5 }], 9)).toBe(false);
    expect(validCages([{ cells: [], sum: 5 }], 9)).toBe(false);
  });
});

describe("variant solver", () => {
  it("solves a 6×6 grid and counts its solutions", () => {
    const mini = geometryOf("mini");
    expect(solveVariant(mini, Array(36).fill(0), { limit: 5 }).count).toBe(5);
    const entry = variantBank.mini[0];
    const found = solveVariant(mini, toGrid(entry.puzzle));
    expect(found.count).toBe(1);
    expect(found.solution!.join("")).toBe(entry.solution);
  });

  it("enforces the diagonals", () => {
    const geometry = geometryOf("diagonal");
    const solution = randomVariantSolution(geometry, seededRandom(3));
    for (const diagonal of diagonalCells(9))
      expect(new Set(diagonal.map((cell) => solution[cell])).size).toBe(9);
    // A classic grid that breaks a diagonal has no diagonal solution.
    const classicOnly = randomVariantSolution(CLASSIC, seededRandom(4));
    const repeated = diagonalCells(9)[0].some(
      (cell, i, all) => all.findIndex((other) => classicOnly[other] === classicOnly[cell]) !== i,
    );
    if (repeated) expect(solveVariant(geometry, classicOnly).count).toBe(0);
  });

  it("enforces cage sums", () => {
    const solution = randomVariantSolution(CLASSIC, seededRandom(5));
    const cages = makeCages(9, solution, seededRandom(6));
    const right = geometryOf("killer", cages);
    expect(solveVariant(right, solution).count).toBe(1);
    // Changing one sum makes the same full grid impossible.
    const wrong = geometryOf("killer", [{ ...cages[0], sum: cages[0].sum + 1 }, ...cages.slice(1)]);
    expect(solveVariant(wrong, solution).count).toBe(0);
  });

  it("rejects givens that already clash", () => {
    const grid = Array(36).fill(0);
    grid[0] = 3;
    grid[1] = 3;
    expect(solveVariant(geometryOf("mini"), grid).count).toBe(0);
  });

  it("detects a puzzle with several solutions", () => {
    expect(hasUniqueVariantSolution(geometryOf("mini"), Array(36).fill(0))).toBe(false);
  });
});

describe("generator", () => {
  it("builds cages that partition the grid with distinct digits and right sums", () => {
    const solution = randomVariantSolution(CLASSIC, seededRandom(11));
    const cages = makeCages(9, solution, seededRandom(12));
    expect(cages.flatMap((c) => c.cells).sort((a, b) => a - b)).toEqual([...Array(81).keys()]);
    for (const cage of cages) {
      const digits = cage.cells.map((cell) => solution[cell]);
      expect(new Set(digits).size).toBe(digits.length);
      expect(digits.reduce((a, b) => a + b, 0)).toBe(cage.sum);
    }
  });

  it("carves puzzles that keep a single solution", () => {
    const geometry = geometryOf("mini");
    const solution = randomVariantSolution(geometry, seededRandom(21));
    const puzzle = carveVariant(geometry, solution, 14, seededRandom(22));
    expect(puzzle.filter(Boolean).length).toBeLessThanOrEqual(20);
    expect(hasUniqueVariantSolution(geometry, puzzle)).toBe(true);
    puzzle.forEach((digit, i) => digit && expect(digit).toBe(solution[i]));
  });
});

describe("variant bank", () => {
  // Checking a grid means solving it. Batches keep each test short even when the run is slowed
  // down by coverage instrumentation, and the whole bank is still checked.
  const BATCH = 10;
  const seen = new Set<string>();
  for (const id of variantIds) {
    for (let from = 0; from < variantBank[id].length; from += BATCH) {
      it(`serves only valid ${variantInfo[id].label} grids with one solution (${from + 1}-${Math.min(from + BATCH, variantBank[id].length)})`, () => {
        if (from === 0) expect(variantBank[id].length).toBeGreaterThanOrEqual(30);
        for (const entry of variantBank[id].slice(from, from + BATCH)) {
          const cages = entry.cages ? cagesFromText(entry.cages) : [];
          const geometry = geometryOf(id, cages);
          const puzzle = toGrid(entry.puzzle);
          const solution = toGrid(entry.solution);
          expect(puzzle).toHaveLength(geometry.size ** 2);
          expect(solution).toHaveLength(geometry.size ** 2);
          expect(seen.has(entry.puzzle)).toBe(false);
          seen.add(entry.puzzle);
          puzzle.forEach((digit, i) => digit && expect(digit).toBe(solution[i]));
          // The solution obeys every rule of the variant…
          for (const unit of distinctUnits({ ...geometry, cages: [] }))
            expect(new Set(unit.map((cell) => solution[cell])).size).toBe(geometry.size);
          for (const cage of cages) {
            const digits = cage.cells.map((cell) => solution[cell]);
            expect(new Set(digits).size).toBe(digits.length);
            expect(digits.reduce((a, b) => a + b, 0)).toBe(cage.sum);
          }
          // …and is the only one.
          const found = solveVariant(geometry, puzzle);
          expect(found.count).toBe(1);
          expect(found.solution!.join("")).toBe(entry.solution);
          if (id === "killer")
            expect(cages.flatMap((c) => c.cells).sort((a, b) => a - b)).toEqual([
              ...Array(81).keys(),
            ]);
        }
      });
    }
  }

  it("keeps clue counts within what each variant promises", () => {
    for (const entry of variantBank.killer)
      expect(entry.puzzle.split("").filter((c) => c !== "0").length).toBeLessThanOrEqual(12);
    for (const entry of variantBank.mini)
      expect(entry.puzzle.split("").filter((c) => c !== "0").length).toBeGreaterThanOrEqual(10);
  });
});

describe("picking a game", () => {
  it("relabels digits without breaking the puzzle, for grids where that is allowed", () => {
    for (const id of ["mini", "diagonal"] as const) {
      const geometry = geometryOf(id);
      const seen = new Set<string>();
      for (let n = 0; n < 12; n++) {
        const { puzzle, solution, cages } = pickVariantGame(id, seededRandom(n + 1));
        seen.add(puzzle.join(""));
        expect(cages).toEqual([]);
        expect(solveVariant(geometry, puzzle).solution).toEqual(solution);
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });

  it("serves killer grids untouched, with cages that match the solution", () => {
    const { puzzle, solution, cages } = pickVariantGame("killer", seededRandom(9));
    expect(variantBank.killer.map((e) => e.solution)).toContain(solution.join(""));
    for (const cage of cages)
      expect(cage.cells.reduce((sum, cell) => sum + solution[cell], 0)).toBe(cage.sum);
    expect(hasUniqueVariantSolution(geometryOf("killer", cages), puzzle)).toBe(true);
  });
});
