/** Difficulty levels offered in solo mode, from easiest to hardest. */
export const soloDifficulties = [
  "Débutant",
  "Facile",
  "Intermédiaire",
  "Difficile",
  "Expert",
  "Maître",
] as const;

export type Difficulty = (typeof soloDifficulties)[number];

export function isSoloDifficulty(value: unknown): value is Difficulty {
  return (soloDifficulties as readonly unknown[]).includes(value);
}
