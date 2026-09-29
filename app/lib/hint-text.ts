import { Technique, type HintPattern, type HintUnit, type LogicalStep } from "@/lib/sudoku-grader";

const unitNames = { row: "la ligne", column: "la colonne", box: "le bloc" } as const;

/** "L2C5": row and column, numbered from 1, as printed around the grid in hints. */
const cellName = (index: number) => `L${Math.floor(index / 9) + 1}C${(index % 9) + 1}`;
const cellList = (cells: readonly number[]) => cells.map(cellName).join(", ");
const digitList = (digits: readonly number[]) =>
  digits.length > 1 ? `${digits.slice(0, -1).join(", ")} et ${digits.at(-1)}` : `${digits[0]}`;
const unitName = (unit: HintUnit) => `${unitNames[unit.kind]} ${unit.number}`;

/** French name of an elimination technique, as taught in Sudoku guides. */
export function techniqueName(pattern: HintPattern) {
  const size = pattern.cells.length;
  switch (pattern.technique) {
    case "lockedCandidates":
      return "Candidats verrouillés";
    case "nakedSubset":
      return size === 2 ? "Paire nue" : "Triplet nu";
    case "hiddenSubset":
      return size === 2 ? "Paire cachée" : "Triplet caché";
    case "xWing":
      return "X-Wing";
  }
}

/** What the technique does on this grid, with the cells and digits involved. */
function explain(pattern: HintPattern) {
  const { cells, digits } = pattern;
  switch (pattern.technique) {
    case "lockedCandidates":
      return `Dans ${unitName(pattern.unit!)}, le ${digits[0]} ne peut aller que dans ${cellList(cells)}, qui sont alignées dans ${unitName(pattern.targetUnit!)}. Le ${digits[0]} est donc impossible dans les autres cases de ${unitName(pattern.targetUnit!)} : retire-le de leurs notes.`;
    case "nakedSubset":
      return `Dans ${unitName(pattern.unit!)}, les cases ${cellList(cells)} ne peuvent contenir que ${digitList(digits)}. Ces chiffres leur sont donc réservés : retire-les des notes des autres cases de ${unitName(pattern.unit!)}.`;
    case "hiddenSubset":
      return `Dans ${unitName(pattern.unit!)}, les chiffres ${digitList(digits)} ne peuvent aller que dans ${cellList(cells)}. Ces cases ne peuvent donc contenir rien d’autre : retire de leurs notes tous les autres chiffres.`;
    case "xWing": {
      const byRow = Math.floor(cells[0] / 9) === Math.floor(cells[1] / 9);
      const lines = [...new Set(cells.map((c) => (byRow ? Math.floor(c / 9) : c % 9) + 1))];
      const crosses = [...new Set(cells.map((c) => (byRow ? c % 9 : Math.floor(c / 9)) + 1))];
      const [line, cross] = byRow ? ["lignes", "colonnes"] : ["colonnes", "lignes"];
      return `Dans les ${line} ${lines.join(" et ")}, le ${digits[0]} n’a que deux places possibles, toujours dans les ${cross} ${crosses.join(" et ")} (${cellList(cells)}). Il occupera donc une diagonale de ce rectangle : retire le ${digits[0]} du reste de ces ${cross}.`;
    }
  }
}

/** Title, explanation and named techniques of a hint, without giving the digit away. */
export function hintText(index: number, step: LogicalStep | null) {
  const cell = `la case ligne ${Math.floor(index / 9) + 1}, colonne ${(index % 9) + 1}`;
  if (!step)
    return {
      title: "Case à débloquer",
      text: `Regarde ${cell}. La déduire demande des techniques avancées, comme les chaînes logiques : tu peux révéler son chiffre.`,
      techniques: [] as string[],
    };
  const techniques = [...new Set((step.patterns ?? []).map(techniqueName))];
  const before = step.pattern
    ? `${
        techniques.length > 1
          ? `Techniques à enchaîner : ${techniques.join(", puis ")}. La plus difficile, « ${techniqueName(step.pattern)} » : `
          : `Technique : « ${techniqueName(step.pattern)} ». `
      }${explain(step.pattern)} Ensuite, r`
    : "R";
  if (step.technique === Technique.NakedSingle)
    return {
      title: "Un seul candidat",
      text: `${before}egarde ${cell} : en croisant sa ligne, sa colonne et son bloc, il ne reste qu’un seul chiffre possible.`,
      techniques,
    };
  return {
    title: "Un seul emplacement",
    text: `${before}egarde ${unitName(step.unit!)} : l’un des chiffres qui y manquent ne peut aller qu’à un seul endroit, ${cell}.`,
    techniques,
  };
}
