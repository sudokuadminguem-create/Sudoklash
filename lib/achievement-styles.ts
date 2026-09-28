// Public appearance only; secret challenge titles and conditions stay on the server.
export const elementLabels: Record<string, string> = {
  leaf: "Feuillage", fire: "Feu", water: "Eau", steel: "Acier", frost: "Givre",
  lightning: "Éclair", splash: "Éclaboussure", meteor: "Météore", aurora: "Aurore", solar: "Soleil",
  crown: "Couronne", lotus: "Lotus", nebula: "Nébuleuse", onyx: "Onyx", prism: "Prisme",
};
export function challengeFrameStyle(id: string) {
  const match = /^challenge-([velm])-(\d{3})$/.exec(id);
  if (!match) return null;
  const number = Number(match[2]),
    rarity = match[1] === "e" ? "epic" : match[1] === "l" ? "legendary" : match[1] === "m" ? "majestic" : "simple";
  // Twenty illustrated families with five different crown silhouettes each.
  const families = [205, 157, 34, 268, 331, 185, 222, 48, 105, 8];
  const index = number - 1;
  const hue = (families[index % 10] + Math.floor(index / 10) * 5) % 360;
  const light = rarity === "majestic" ? 80 : rarity === "legendary" ? 76 : rarity === "epic" ? 70 : 64;
  const symbols = ["✦", "◆", "✧", "✳", "◇", "❖", "✺", "◈", "✵", "⬡"];
  const epicThemes = ["leaf", "fire", "water", "steel", "frost"] as const;
  const legendaryThemes = ["lightning", "splash", "meteor", "aurora", "solar"] as const;
  const majesticThemes = ["crown", "lotus", "nebula", "onyx", "prism"] as const;
  const element = rarity === "epic" ? epicThemes[index % 5] : rarity === "legendary" ? legendaryThemes[index % 5] : rarity === "majestic" ? majesticThemes[index % 5] : null;
  const elementHues: Record<string, number> = {
    leaf: 132, fire: 19, water: 194, steel: 216, frost: 187,
    lightning: 53, splash: 198, meteor: 11, aurora: 279, solar: 40,
    crown: 44, lotus: 319, nebula: 257, onyx: 209, prism: 166,
  };
  const tone = element ? (elementHues[element] + Math.floor(index / 5) * 7) % 360 : hue;
  return {
    rarity,
    color: `hsl(${tone} 91% ${light}%)`,
    accent: `hsl(${(tone + (rarity === "simple" ? 31 : 28)) % 360} 77% 35%)`,
    highlight: `hsl(${(tone + 13) % 360} 100% 91%)`,
    symbol: symbols[(index + Math.floor(index / 10)) % 10],
    pattern: Math.floor(index / 10) % 10,
    element,
    variant: rarity === "simple" ? index % 5 : Math.floor(index / 5),
    motif: rarity === "simple" ? Math.floor(index / 5) : 0,
  };
}
