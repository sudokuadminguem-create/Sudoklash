export const freeAvatars = [
  { id: "nova", name: "Nova", symbol: "✦", colors: ["#284bba", "#6edafa"] },
  { id: "zenith", name: "Zénith", symbol: "☀", colors: ["#ad5522", "#ffcf63"] },
  { id: "orbit", name: "Orbite", symbol: "◉", colors: ["#6533c9", "#bba1ff"] },
  { id: "prism", name: "Prisme", symbol: "◆", colors: ["#0a7b90", "#6ce6df"] },
  { id: "pulse", name: "Pulse", symbol: "ϟ", colors: ["#9f287e", "#ff8cce"] },
  { id: "matrix", name: "Matrice", symbol: "▦", colors: ["#187b5d", "#9ee8a2"] },
  { id: "comet", name: "Comète", symbol: "✧", colors: ["#3659ac", "#f39c82"] },
  { id: "cipher", name: "Cipher", symbol: "9", colors: ["#283650", "#83a7ed"] },
  { id: "rook", name: "Tour", symbol: "♜", colors: ["#69523b", "#ead49a"] },
  { id: "rune", name: "Rune", symbol: "⌘", colors: ["#5944ad", "#a5dcf7"] },
  { id: "spark", name: "Étincelle", symbol: "✷", colors: ["#ac444d", "#ffc197"] },
  { id: "wave", name: "Vague", symbol: "≈", colors: ["#087dac", "#8ddceb"] },
  { id: "delta", name: "Delta", symbol: "△", colors: ["#aa5a29", "#f6b857"] },
  { id: "lumen", name: "Lumen", symbol: "✺", colors: ["#83702c", "#e9dc92"] },
  { id: "onyx", name: "Onyx", symbol: "⬡", colors: ["#34435f", "#bbc9ea"] },
] as const;

export const shopAvatars = [
  { id: "neon", name: "Néon", symbol: "✹", colors: ["#6323d3", "#40e7fd"], price: 300 },
  { id: "sakura", name: "Sakura", symbol: "❀", colors: ["#c14b8c", "#ffd1e8"], price: 450 },
  { id: "solar", name: "Solaire", symbol: "☼", colors: ["#c7671d", "#ffe681"], price: 600 },
  { id: "eclipse", name: "Éclipse", symbol: "◐", colors: ["#26185f", "#cba9ff"], price: 800 },
  { id: "crown", name: "Couronne", symbol: "♛", colors: ["#9d7225", "#f5d68a"], price: 1000 },
] as const;

export const gridThemes = [
  { id: "ocean", name: "Océan profond", price: 0, colors: ["#0077ff", "#00e5c7"] },
  { id: "tokyo", name: "Néon Tokyo", price: 900, colors: ["#d93cff", "#25d9ff"] },
  { id: "galaxy", name: "Galaxie", price: 1000, colors: ["#6229ff", "#e85cff"] },
  { id: "sakura-grid", name: "Sakura", price: 850, colors: ["#ff80b9", "#ffd1e5"] },
  { id: "circuit", name: "Circuit quantique", price: 1200, colors: ["#15e3a8", "#a5ffce"] },
  { id: "obsidian", name: "Obsidienne", price: 700, colors: ["#1b2139", "#667299"] },
] as const;

export const achievementAvatars = [
  {
    id: "solver",
    name: "Persévérant",
    symbol: "✓",
    colors: ["#187c68", "#a0e8c4"],
    requirement: "Terminer 10 grilles solo",
    unlocked: (s: ProgressCounts) => s.solo >= 10,
  },
  {
    id: "streak",
    name: "Régulier",
    symbol: "✳",
    colors: ["#2768a6", "#9ee4f4"],
    requirement: "Terminer 7 défis quotidiens",
    unlocked: (s: ProgressCounts) => s.daily >= 7,
  },
  {
    id: "legend",
    name: "Légende",
    symbol: "★",
    colors: ["#8c4136", "#ffcf8b"],
    requirement: "Gagner 20 parties classées",
    unlocked: (s: ProgressCounts) => s.wins >= 20,
  },
] as const;

export const avatars = [...freeAvatars, ...shopAvatars, ...achievementAvatars];
export type ProgressCounts = {
  solo: number;
  daily: number;
  weekly: number;
  wins: number;
  losses: number;
};
export const levelFrames = [
  { level: 1, id: "starter", name: "Initial", color: "#526688" },
  { level: 5, id: "azure", name: "Azur", color: "#4b93ff" },
  { level: 10, id: "jade", name: "Jade", color: "#48d5b1" },
  { level: 20, id: "amethyst", name: "Améthyste", color: "#ad78ff" },
  { level: 30, id: "gold", name: "Or", color: "#ffd16c" },
  { level: 50, id: "aurora", name: "Aurore", color: "#ff8cbd" },
  { level: 75, id: "cosmic", name: "Cosmique", color: "#92eeed" },
  { level: 100, id: "legendary", name: "Légendaire", color: "#fff0a8" },
] as const;

export const rankedFrames = [
  { id: "Bronze", name: "Forge de bronze", color: "#cf8650", accent: "#6b3928", symbol: "◆" },
  { id: "Silver", name: "Éclat d'argent", color: "#e1edff", accent: "#7395bf", symbol: "✦" },
  { id: "Gold", name: "Couronne solaire", color: "#ffda66", accent: "#b56a20", symbol: "✧" },
  { id: "Platine", name: "Aurore de platine", color: "#72f6e5", accent: "#287faf", symbol: "✦" },
  { id: "Diamant", name: "Prisme de diamant", color: "#a9c6ff", accent: "#805de5", symbol: "◆" },
  {
    id: "Challenger",
    name: "Énergie challenger",
    color: "#fd8dbb",
    accent: "#8a4de7",
    symbol: "✷",
  },
  { id: "Maître", name: "Couronne du maître", color: "#fff2a1", accent: "#ef7096", symbol: "✹" },
] as const;

// Only completed results saved by the server contribute. Existing results count too.
export function progressFor(s: ProgressCounts) {
  const xp = s.solo * 35 + s.daily * 100 + s.weekly * 250 + s.wins * 120 + s.losses * 40;
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const current = 100 * (level - 1) ** 2,
    next = 100 * level ** 2;
  return {
    xp,
    level,
    levelXp: xp - current,
    nextLevelXp: next - current,
    earnedCoins: 300 + s.solo * 20 + s.daily * 60 + s.weekly * 150 + s.wins * 70,
  };
}
