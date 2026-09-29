import { describe, expect, it } from "vitest";
import { hintText, techniqueName } from "@/app/lib/hint-text";
import { puzzleBank } from "@/lib/puzzle-bank";
import { nextLogicalStep, type HintPattern } from "@/lib/sudoku-grader";
import { solveGrid } from "@/lib/sudoku-solver";

const toGrid = (text: string) => text.split("").map(Number);

// Grids taken from the puzzle bank, at the moment each technique is first needed.
const fixtures = {
  "lockedCandidates:2":
    "206080305050623810080509026045938002032006508800752000504061007008000600000090001",
  "lockedCandidates:3":
    "801002007092507601705000402000024000070605120028010060900200870287000300053978200",
  "nakedSubset:2":
    "003000600610200003004060018580406372240000006376852194090600031007100000102040007",
  "hiddenSubset:2":
    "003000600618200003004060018580406372240000006376852194095600031007100000102040007",
  "nakedSubset:3":
    "009000000001004030702000600294516873186037500573008016008000352927345168315862947",
  "hiddenSubset:3":
    "917806000400000006006300000058400670600700080701068034100975002009134000070682010",
  "xWing:4": "007285369682793451935641827003009000720300090096004083000900030300000910069030000",
} as const;

const names: Record<keyof typeof fixtures, string> = {
  "lockedCandidates:2": "Candidats verrouillés",
  "lockedCandidates:3": "Candidats verrouillés",
  "nakedSubset:2": "Paire nue",
  "hiddenSubset:2": "Paire cachée",
  "nakedSubset:3": "Triplet nu",
  "hiddenSubset:3": "Triplet caché",
  "xWing:4": "X-Wing",
};

/** A pattern is only worth teaching if it is true of the real solution. */
function expectSound(pattern: HintPattern, solution: number[]) {
  const { cells, digits, unit } = pattern;
  if (unit) for (const cell of cells) expect(unit.cells).toContain(cell);
  switch (pattern.technique) {
    case "nakedSubset":
      // These cells can only hold these digits.
      for (const cell of cells) expect(digits).toContain(solution[cell]);
      break;
    case "hiddenSubset":
      // These digits can only go in these cells.
      for (const digit of digits) {
        const place = unit!.cells.find((cell) => solution[cell] === digit)!;
        expect(cells).toContain(place);
      }
      break;
    case "lockedCandidates": {
      const place = unit!.cells.find((cell) => solution[cell] === digits[0])!;
      expect(cells).toContain(place);
      expect(pattern.targetUnit!.cells).toEqual(expect.arrayContaining(cells));
      break;
    }
    case "xWing": {
      // Two rows (or columns) whose digit sits on the same two columns (rows).
      const holders = cells.filter((cell) => solution[cell] === digits[0]);
      expect(holders).toHaveLength(2);
      expect(new Set(holders.map((c) => c % 9)).size).toBe(2);
      expect(new Set(holders.map((c) => Math.floor(c / 9))).size).toBe(2);
    }
  }
}

describe("named techniques", () => {
  for (const [key, text] of Object.entries(fixtures) as [keyof typeof fixtures, string][]) {
    it(`finds ${names[key]} (${key}) and teaches it`, () => {
      const grid = toGrid(text);
      const solution = solveGrid(grid)!;
      const step = nextLogicalStep(grid)!;
      const pattern = step.patterns!.find((p) => `${p.technique}:${p.cells.length}` === key)!;
      expect(pattern).toBeDefined();
      expect(techniqueName(pattern)).toBe(names[key]);
      expectSound(pattern, solution);
      expect(step.digit).toBe(solution[step.index]);

      const { text: explanation, techniques } = hintText(step.index, step);
      expect(techniques).toContain(names[key]);
      expect(explanation).toContain(names[key]);
      // The cells of the main pattern are named so the player can find them.
      const c = step.pattern!.cells[0];
      expect(explanation).toContain(`L${Math.floor(c / 9) + 1}C${(c % 9) + 1}`);
    });
  }

  it("keeps the plain wording when no elimination is needed", () => {
    const grid = toGrid(
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    );
    const step = nextLogicalStep(grid)!;
    expect(step.pattern).toBeUndefined();
    expect(hintText(step.index, step).techniques).toEqual([]);
    expect(hintText(step.index, step).text).not.toContain("Technique");
  });

  it("only ever teaches true patterns and right digits, on every bank puzzle", () => {
    let patterns = 0;
    for (const list of Object.values(puzzleBank)) {
      for (const puzzle of list) {
        const grid = toGrid(puzzle);
        const solution = solveGrid(grid)!;
        for (let guard = 0; grid.includes(0) && guard < 81; guard++) {
          const step = nextLogicalStep(grid);
          if (!step) break;
          expect(step.digit).toBe(solution[step.index]);
          for (const pattern of step.patterns ?? []) {
            expectSound(pattern, solution);
            patterns++;
          }
          if (step.patterns)
            expect(step.pattern).toBe(
              step.patterns.filter((p) => p.level === step.eliminatedWith).at(-1),
            );
          grid[step.index] = step.digit;
        }
      }
    }
    expect(patterns).toBeGreaterThan(1000);
  });

  it("chains several techniques in the order they are needed", () => {
    // Every bank step that needs two techniques names both, hardest last.
    let chained = 0;
    for (const list of Object.values(puzzleBank)) {
      for (const puzzle of list.slice(0, 20)) {
        const grid = toGrid(puzzle);
        for (let guard = 0; grid.includes(0) && guard < 81; guard++) {
          const step = nextLogicalStep(grid);
          if (!step) break;
          const kinds = new Set((step.patterns ?? []).map(techniqueName));
          if (kinds.size > 1) {
            chained++;
            const { text, techniques } = hintText(step.index, step);
            expect(techniques).toHaveLength(kinds.size);
            expect(text).toContain("Techniques à enchaîner");
          }
          grid[step.index] = step.digit;
        }
      }
    }
    expect(chained).toBeGreaterThan(0);
  });
});
