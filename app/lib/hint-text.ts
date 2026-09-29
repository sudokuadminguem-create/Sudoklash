import { tFr, type Translate } from "@/app/lib/i18n-core";
import { Technique, type HintPattern, type HintUnit, type LogicalStep } from "@/lib/sudoku-grader";

const unitKeys = {
  row: "hint.unit.row",
  column: "hint.unit.column",
  box: "hint.unit.box",
} as const;

/** "L2C5": row and column, numbered from 1, as printed around the grid in hints. */
const cellName = (index: number) => `L${Math.floor(index / 9) + 1}C${(index % 9) + 1}`;
const cellList = (cells: readonly number[]) => cells.map(cellName).join(", ");
const digitList = (digits: readonly number[], t: Translate) =>
  digits.length > 1
    ? `${digits.slice(0, -1).join(", ")} ${t("hint.and")} ${digits.at(-1)}`
    : `${digits[0]}`;
const unitName = (unit: HintUnit, t: Translate) => `${t(unitKeys[unit.kind])} ${unit.number}`;

/** Name of an elimination technique, as taught in Sudoku guides. */
export function techniqueName(pattern: HintPattern, t: Translate = tFr) {
  const size = pattern.cells.length;
  switch (pattern.technique) {
    case "lockedCandidates":
      return t("hint.technique.lockedCandidates");
    case "nakedSubset":
      return t(size === 2 ? "hint.technique.nakedPair" : "hint.technique.nakedTriple");
    case "hiddenSubset":
      return t(size === 2 ? "hint.technique.hiddenPair" : "hint.technique.hiddenTriple");
    case "xWing":
      return t("hint.technique.xWing");
  }
}

/** What the technique does on this grid, with the cells and digits involved. */
function explain(pattern: HintPattern, t: Translate) {
  const { cells, digits } = pattern;
  switch (pattern.technique) {
    case "lockedCandidates":
      return t("hint.locked", {
        unit: unitName(pattern.unit!, t),
        digit: digits[0],
        cells: cellList(cells),
        target: unitName(pattern.targetUnit!, t),
      });
    case "nakedSubset":
      return t("hint.naked", {
        unit: unitName(pattern.unit!, t),
        cells: cellList(cells),
        digits: digitList(digits, t),
      });
    case "hiddenSubset":
      return t("hint.hidden", {
        unit: unitName(pattern.unit!, t),
        cells: cellList(cells),
        digits: digitList(digits, t),
      });
    case "xWing": {
      const byRow = Math.floor(cells[0] / 9) === Math.floor(cells[1] / 9);
      const lines = [...new Set(cells.map((c) => (byRow ? Math.floor(c / 9) : c % 9) + 1))];
      const crosses = [...new Set(cells.map((c) => (byRow ? c % 9 : Math.floor(c / 9)) + 1))];
      const [line, cross] = byRow
        ? [t("hint.lines"), t("hint.columns")]
        : [t("hint.columns"), t("hint.lines")];
      return t("hint.xwing", {
        lines: line,
        lineList: lines.join(` ${t("hint.and")} `),
        digit: digits[0],
        crosses: cross,
        crossList: crosses.join(` ${t("hint.and")} `),
        cells: cellList(cells),
      });
    }
  }
}

/** Title, explanation and named techniques of a hint, without giving the digit away. */
export function hintText(index: number, step: LogicalStep | null, t: Translate = tFr) {
  const cell = t("hint.cellName", { row: Math.floor(index / 9) + 1, col: (index % 9) + 1 });
  if (!step)
    return {
      title: t("hint.lockedTitle"),
      text: t("hint.lockedText", { cell }),
      techniques: [] as string[],
    };
  const techniques = [...new Set((step.patterns ?? []).map((p) => techniqueName(p, t)))];
  const lead = step.pattern
    ? `${
        techniques.length > 1
          ? t("hint.chain", {
              list: techniques.join(t("hint.chainJoin")),
              hardest: techniqueName(step.pattern, t),
            })
          : t("hint.single", { name: techniqueName(step.pattern, t) })
      }${explain(step.pattern, t)} ${t("hint.then")}`
    : t("hint.look");
  if (step.technique === Technique.NakedSingle)
    return {
      title: t("hint.nakedSingleTitle"),
      text: t("hint.nakedSingleText", { lead, cell }),
      techniques,
    };
  return {
    title: t("hint.hiddenSingleTitle"),
    text: t("hint.hiddenSingleText", { lead, unit: unitName(step.unit!, t), cell }),
    techniques,
  };
}
