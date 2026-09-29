import { variantBank } from "@/lib/variant-bank";
import { cagesFromText, variantInfo, type Cage, type VariantId } from "@/lib/variants";

/**
 * A bank grid of a variant. Digits are relabelled at random where that keeps the puzzle intact:
 * a permutation of the digits only changes names for "every digit once" rules, but would change
 * the sums of a killer grid, so killer grids are served as they are.
 */
export function pickVariantGame(id: VariantId, random: () => number = Math.random) {
  const list = variantBank[id];
  const entry = list[Math.floor(random() * list.length)];
  let puzzle = entry.puzzle.split("").map(Number);
  let solution = entry.solution.split("").map(Number);
  const cages: Cage[] = entry.cages ? cagesFromText(entry.cages) : [];
  if (!variantInfo[id].killer) {
    const digits = Array.from({ length: variantInfo[id].size }, (_, i) => i + 1);
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    const relabel = (grid: number[]) => grid.map((d) => (d ? digits[d - 1] : 0));
    puzzle = relabel(puzzle);
    solution = relabel(solution);
  }
  return { puzzle, solution, cages };
}
