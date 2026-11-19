import { expect, it } from "vitest";
import { variantBank } from "@/lib/variant-bank";
import { solveVariant } from "@/lib/variant-solver";
import {
  cagesFromText,
  distinctUnits,
  geometryOf,
  variantInfo,
  type VariantId,
} from "@/lib/variants";

const toGrid = (text: string) => text.split("").map(Number);

/**
 * Checks one share of a variant's bank: every grid follows the rules and has a single solution.
 *
 * Checking a grid means solving it, which is slow (Killer above all, and more so under coverage
 * instrumentation). Vitest runs files in parallel but the tests of one file one after the other,
 * so the bank is split across several test files (`part` of `parts`) to use every core. Batches
 * keep each test short; the whole bank is still checked.
 */
export function checkVariantBank(id: VariantId, part = 1, parts = 1) {
  const BATCH = 10;
  // Grids are dealt in turn to each part (not in contiguous blocks): hard grids are not all
  // next to each other, so the parts take about the same time.
  const share = variantBank[id]
    .map((entry, index) => ({ entry, index }))
    .filter(({ index }) => index % parts === part - 1);
  for (let from = 0; from < share.length; from += BATCH) {
    const batch = share.slice(from, from + BATCH);
    const label = `#${batch[0].index + 1} to #${batch.at(-1)!.index + 1}`;
    it(`serves only valid ${variantInfo[id].label} grids with one solution (${label})`, () => {
      for (const { entry } of batch) {
        const cages = entry.cages ? cagesFromText(entry.cages) : [];
        const geometry = geometryOf(id, cages);
        const puzzle = toGrid(entry.puzzle);
        const solution = toGrid(entry.solution);
        expect(puzzle).toHaveLength(geometry.size ** 2);
        expect(solution).toHaveLength(geometry.size ** 2);
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
