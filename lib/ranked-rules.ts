export const rankedPuzzles = {
  Facile: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  Intermédiaire:
    "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
  Difficile: "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
  Expert: "005300000800000020070010500400005300010070006003200080060500009004000030000009700",
  Maître: "100007090030020008009600500005300900010080002600004000300000010040000007007000300",
} as const;
export type RankedDifficulty = keyof typeof rankedPuzzles;

export function rankFor(points: number, position: number | null = null) {
  if (points >= 1500) {
    const name = points >= 1700 && position !== null && position <= 100 ? "Maître" : "Challenger";
    return {
      name,
      label: name,
      difficulty: (name === "Maître" ? "Maître" : "Expert") as RankedDifficulty,
      progress: points - 1500,
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
