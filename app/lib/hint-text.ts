import { Technique, type LogicalStep, type TechniqueLevel } from "@/lib/sudoku-grader";

const unitNames = { row: "la ligne", column: "la colonne", box: "le bloc" } as const;
const eliminationNames: Partial<Record<TechniqueLevel, string>> = {
  [Technique.LockedCandidates]:
    "les candidats verrouillés (un chiffre confiné à une seule ligne ou colonne d’un bloc)",
  [Technique.Pairs]: "les paires (deux cases d’une zone qui se partagent les deux mêmes chiffres)",
  [Technique.TriplesAndXWing]: "les triplets ou le X-Wing",
};

/** Title and explanation of a hint, without giving the digit away. */
export function hintText(index: number, step: LogicalStep | null) {
  const cell = `la case ligne ${Math.floor(index / 9) + 1}, colonne ${(index % 9) + 1}`;
  if (!step)
    return {
      title: "Case à débloquer",
      text: `Regarde ${cell}. La déduire demande des techniques avancées, comme les chaînes logiques : tu peux révéler son chiffre.`,
    };
  const before = step.eliminatedWith
    ? `Commence par éliminer des candidats avec ${eliminationNames[step.eliminatedWith]}. Ensuite, r`
    : "R";
  if (step.technique === Technique.NakedSingle)
    return {
      title: "Un seul candidat",
      text: `${before}egarde ${cell} : en croisant sa ligne, sa colonne et son bloc, il ne reste qu’un seul chiffre possible.`,
    };
  const unit = `${unitNames[step.unit!.kind]} ${step.unit!.number}`;
  return {
    title: "Un seul emplacement",
    text: `${before}egarde ${unit} : l’un des chiffres qui y manquent ne peut aller qu’à un seul endroit, ${cell}.`,
  };
}
