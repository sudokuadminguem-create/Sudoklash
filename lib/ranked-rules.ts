import type { Difficulty } from "@/lib/difficulties";

/** Ranked games never use the beginner level. */
export type RankedDifficulty = Exclude<Difficulty, "Débutant">;

/** Points from which a player leaves the tiered ranks and becomes Challenger. */
export const CHALLENGER_MIN_POINTS = 1500;
/** Points required, along with a top-100 place, to reach the Maître rank. */
export const MASTER_MIN_POINTS = 1700;
const MASTER_MAX_POSITION = 100;

export function rankFor(points: number, position: number | null = null) {
  if (points >= CHALLENGER_MIN_POINTS) {
    const name =
      points >= MASTER_MIN_POINTS && position !== null && position <= MASTER_MAX_POSITION
        ? "Maître"
        : "Challenger";
    return {
      name,
      label: name,
      difficulty: (name === "Maître" ? "Maître" : "Expert") as RankedDifficulty,
      progress: points - CHALLENGER_MIN_POINTS,
    };
  }
  const bands = ["Bronze", "Silver", "Gold", "Platine", "Diamant"] as const;
  const band = Math.max(0, Math.min(4, Math.floor(points / 300)));
  const tier = Math.floor((points % 300) / 100) + 1;
  const name = bands[band];
  const difficulty: RankedDifficulty =
    band === 0 ? "Facile" : band <= 2 ? "Intermédiaire" : "Difficile";
  return { name, label: `${name} ${tier}`, difficulty, progress: points % 100 };
}

export function rankedPointChange(winnerFilled: number, loserFilled: number, totalToFill: number) {
  const difference = Math.min(totalToFill, Math.max(0, winnerFilled - loserFilled));
  return 18 + Math.round((8 * difference) / Math.max(1, totalToFill));
}
