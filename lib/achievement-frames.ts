// The catalogue is shared by the server (awards) and the client (presentation).
// Progress is derived exclusively from completed, server-recorded results.
export type Metric =
  | "mini"
  | "killer"
  | "solo"
  | "beginner"
  | "easy"
  | "medium"
  | "hard"
  | "expert"
  | "master"
  | "fast5"
  | "fast10"
  | "fast20"
  | "daily"
  | "weekly"
  | "dailyClean"
  | "weeklyClean"
  | "dailyStreak"
  | "weeklyStreak"
  | "ranked"
  | "wins"
  | "rankedStreak"
  | "friends"
  | "opponents"
  | "points"
  | "level"
  | "xp"
  | "frames"
  | "soloDays"
  | "dailyDays"
  | "weeklyTop"
  | "soloBest"
  | "rankedClose"
  | "rankedWide"
  | "soloClean"
  | "soloNoHint"
  | "soloPerfect"
  | "masterClean"
  | "soloMaxDay"
  | "dailyFast10"
  | "weeklyFast30"
  | "dailyCleanStreak"
  | "rankedCleanWins"
  | "rankedEasyWins"
  | "rankedMediumWins"
  | "rankedHardWins"
  | "rankedExpertWins"
  | "rankedMasterWins"
  | "soloAt909"
  | "soloTime909"
  | "soloAt2359"
  | "soloAt0000"
  | "doubleChallengeDays"
  | "perfectWeeks"
  | "soloStreak"
  | "allDifficulties"
  | "expertClean"
  | "epicFrames"
  | "otherFrames";
export type Achievement = {
  id: string;
  name: string;
  requirement: string;
  metric: Metric;
  target: number;
  rarity: "simple" | "epic" | "legendary" | "majestic";
  color: string;
  accent: string;
  symbol: string;
};
type Entry = [string, string, Metric, number, string];
const palette = [
  ["#73baff", "#244cab"],
  ["#65d8ae", "#176259"],
  ["#ffc981", "#a1592d"],
  ["#c7a0ff", "#6942b3"],
  ["#f496c4", "#993f7d"],
  ["#96dbe5", "#296b8c"],
  ["#e1e8ff", "#58689b"],
  ["#f2da88", "#98702d"],
  ["#a4ec8d", "#42865a"],
  ["#ef9d91", "#a74747"],
] as const;
const symbols = ["✦", "◆", "✧", "✳", "◇", "❖", "✺", "◈", "✵", "⬡"];
function make(rows: Entry[], rarity: Achievement["rarity"], prefix: string): Achievement[] {
  return rows.map(([name, requirement, metric, target, symbol], index) => {
    const pair = palette[index % palette.length];
    return {
      id: `challenge-${prefix}-${String(index + 1).padStart(3, "0")}`,
      name,
      requirement,
      metric,
      target,
      rarity,
      color: pair[0],
      accent: pair[1],
      symbol: symbol || symbols[index % 10],
    };
  });
}
const visible: Entry[] = [
  ["Premier pas", "Terminer 1 grille solo", "solo", 1, "✦"],
  ["Carnet", "Terminer 5 grilles solo", "solo", 5, "▤"],
  ["Crayon", "Terminer 10 grilles solo", "solo", 10, "✎"],
  ["Gomme", "Terminer 25 grilles solo", "solo", 25, "▱"],
  ["Encrier", "Terminer 50 grilles solo", "solo", 50, "✒"],
  ["Quadrillage", "Terminer 100 grilles solo", "solo", 100, "▦"],
  ["Archiviste", "Terminer 250 grilles solo", "solo", 250, "▣"],
  ["Marbre", "Terminer 500 grilles solo", "solo", 500, "◇"],
  ["Pilier", "Terminer 1 000 grilles solo", "solo", 1000, "⬡"],
  ["Habitude", "Jouer en solo pendant 7 jours différents", "soloDays", 7, "◷"],
  ["Feuille", "Terminer 1 grille facile", "easy", 1, "❧"],
  ["Prairie", "Terminer 20 grilles faciles", "easy", 20, "✿"],
  ["Cuivre", "Terminer 1 grille intermédiaire", "medium", 1, "◇"],
  ["Rouage", "Terminer 20 grilles intermédiaires", "medium", 20, "⚙"],
  ["Ardoise", "Terminer 1 grille difficile", "hard", 1, "▰"],
  ["Roc", "Terminer 20 grilles difficiles", "hard", 20, "◆"],
  ["Obsidienne", "Terminer 1 grille experte", "expert", 1, "⬟"],
  ["Sommet", "Terminer 20 grilles expertes", "expert", 20, "▲"],
  ["Boussole", "Terminer 1 grille maître", "master", 1, "✥"],
  ["Prisme", "Terminer 10 grilles maître", "master", 10, "◈"],
  ["Ligne nette", "Terminer 1 grille solo sans erreur", "soloClean", 1, "╱"],
  ["Verrière", "Terminer 10 grilles solo sans erreur", "soloClean", 10, "◫"],
  ["Diamant brut", "Terminer 25 grilles solo sans erreur ni indice", "soloPerfect", 25, "◆"],
  ["Autonomie", "Terminer 1 grille solo sans indice", "soloNoHint", 1, "✳"],
  ["Sage", "Terminer 25 grilles solo sans indice", "soloNoHint", 25, "⌘"],
  ["Minimaliste", "Finir 1 grille solo en moins de 10 min", "fast10", 1, "○"],
  ["Épure", "Finir 20 grilles solo en moins de 10 min", "fast10", 20, "◎"],
  ["Cristal", "Terminer 1 grille solo sans erreur ni indice", "soloPerfect", 1, "◈"],
  ["Éclat", "Terminer 10 grilles solo sans erreur ni indice", "soloPerfect", 10, "✧"],
  ["Maîtrise", "Terminer 50 grilles difficiles", "hard", 50, "♜"],
  ["Sablier", "Terminer 10 grilles solo en moins de 5 min", "fast5", 10, "⌛"],
  ["Chrono", "Terminer 50 grilles solo en moins de 10 min", "fast10", 50, "◴"],
  ["Aiguille", "Terminer 100 grilles solo en moins de 20 min", "fast20", 100, "↗"],
  ["Horloger", "Terminer 100 grilles solo en moins de 10 min", "fast10", 100, "◷"],
  ["Étincelle", "Terminer 100 grilles faciles", "easy", 100, "✶"],
  ["Éclair", "Terminer 100 grilles intermédiaires", "medium", 100, "ϟ"],
  ["Traînée", "Terminer 100 grilles difficiles", "hard", 100, "➶"],
  ["Trio", "Terminer 3 grilles maître", "master", 3, "✦"],
  ["Marathon", "Terminer 150 grilles solo", "solo", 150, "∞"],
  ["Endurance", "Terminer 300 grilles solo", "solo", 300, "⟡"],
  ["Aube", "Terminer 1 grille quotidienne", "daily", 1, "☀"],
  ["Semaine", "Terminer 7 grilles quotidiennes", "daily", 7, "✷"],
  ["Calendrier", "Terminer 30 grilles quotidiennes", "daily", 30, "▦"],
  ["Saison", "Terminer 100 grilles quotidiennes", "daily", 100, "❀"],
  ["Série", "Réussir 3 quotidiennes consécutives", "dailyStreak", 3, "➂"],
  ["Semaine parfaite", "Réussir 7 quotidiennes consécutives", "dailyStreak", 7, "✧"],
  ["Quinzaine", "Réussir 14 quotidiennes consécutives", "dailyStreak", 14, "❖"],
  ["Constance", "Réussir 30 quotidiennes consécutives", "dailyStreak", 30, "◎"],
  ["Jour parfait", "Terminer 1 quotidienne sans erreur", "dailyClean", 1, "☼"],
  ["Rayon", "Terminer 10 quotidiennes sans erreur", "dailyClean", 10, "✺"],
  ["Dimanche", "Terminer 1 grille hebdomadaire", "weekly", 1, "◐"],
  ["Cycle", "Terminer 4 grilles hebdomadaires", "weekly", 4, "◉"],
  ["Trimestre", "Terminer 12 grilles hebdomadaires", "weekly", 12, "◈"],
  ["Demi-année", "Terminer 26 grilles hebdomadaires", "weekly", 26, "◑"],
  ["Année", "Terminer 52 grilles hebdomadaires", "weekly", 52, "◌"],
  ["Duo", "Réussir 2 hebdomadaires consécutives", "weeklyStreak", 2, "◈"],
  ["Régularité", "Réussir 4 hebdomadaires consécutives", "weeklyStreak", 4, "✳"],
  ["Sceau", "Terminer 1 hebdomadaire sans erreur", "weeklyClean", 1, "⬡"],
  ["Grand sceau", "Terminer 10 hebdomadaires sans erreur", "weeklyClean", 10, "✥"],
  ["Progression", "Terminer 20 hebdomadaires sans erreur", "weeklyClean", 20, "↗"],
  ["Duel", "Jouer 1 partie classée", "ranked", 1, "⚔"],
  ["Arène", "Jouer 10 parties classées", "ranked", 10, "◉"],
  ["Gradins", "Jouer 50 parties classées", "ranked", 50, "▤"],
  ["Victoire", "Gagner 1 partie classée", "wins", 1, "❖"],
  ["Laurier", "Gagner 10 parties classées", "wins", 10, "❧"],
  ["Trophée", "Gagner 50 parties classées", "wins", 50, "♜"],
  ["Champion", "Gagner 100 parties classées", "wins", 100, "♛"],
  ["Duel précis", "Gagner 5 parties classées consécutives", "rankedStreak", 5, "✧"],
  ["Fine lame", "Gagner 10 parties classées consécutives", "rankedStreak", 10, "✦"],
  ["Photo-finish", "Gagner avec 1 case d'avance en classé", "rankedClose", 1, "◌"],
  ["Mosaïque", "Gagner 5 parties classées", "wins", 5, "▦"],
  ["Maçon", "Jouer 100 parties classées", "ranked", 100, "▣"],
  ["Architecte", "Jouer 500 parties classées", "ranked", 500, "⌂"],
  ["Percée", "Gagner avec au moins 10 cases d'avance", "rankedWide", 1, "↗"],
  ["Remontée", "Gagner 5 fois avec au moins 10 cases d'avance", "rankedWide", 5, "↗"],
  ["Triplé", "Gagner 3 parties classées consécutives", "rankedStreak", 3, "✵"],
  ["Rencontre", "Affronter 5 adversaires classés différents", "opponents", 5, "✧"],
  ["Voyageur", "Affronter 20 adversaires classés différents", "opponents", 20, "✥"],
  ["Salon", "Ajouter 1 ami", "friends", 1, "♧"],
  ["Invitation", "Ajouter 5 amis", "friends", 5, "◇"],
  ["Amitié", "Ajouter 2 amis", "friends", 2, "♡"],
  ["Complice", "Ajouter 10 amis", "friends", 10, "♧"],
  ["Équipe", "Ajouter 20 amis", "friends", 20, "✳"],
  ["Cercle d'amis", "Ajouter 50 amis", "friends", 50, "◎"],
  ["Rival amical", "Affronter 50 adversaires classés différents", "opponents", 50, "⚔"],
  ["Aspirant", "Atteindre 100 points classés", "points", 100, "▲"],
  ["Challenger", "Atteindre 300 points classés", "points", 300, "✦"],
  ["Compétiteur", "Atteindre 600 points classés", "points", 600, "✧"],
  ["Vétéran", "Atteindre 900 points classés", "points", 900, "✥"],
  ["Ambition", "Atteindre 1 200 points classés", "points", 1200, "◆"],
  ["Précision", "Terminer 25 quotidiennes sans erreur", "dailyClean", 25, "◈"],
  ["Élan", "Atteindre 1 500 points classés", "points", 1500, "↗"],
  ["Bronze", "Gagner 1 duel classé en difficulté facile", "rankedEasyWins", 1, "◆"],
  ["Silver", "Gagner 1 duel classé en difficulté intermédiaire", "rankedMediumWins", 1, "✦"],
  ["Gold", "Gagner 10 duels classés en difficulté intermédiaire", "rankedMediumWins", 10, "✧"],
  ["Nouveau visage", "Atteindre le niveau 5", "level", 5, "◇"],
  ["Collectionneur", "Atteindre le niveau 10", "level", 10, "▤"],
  ["Vitrine", "Atteindre le niveau 20", "level", 20, "◫"],
  ["Galerie", "Atteindre le niveau 30", "level", 30, "▣"],
  ["Centurion", "Atteindre 10 000 XP", "xp", 10000, "✹"],
];
const epic: Entry[] = [
  ["Neuf heures neuf", "Terminer une grille solo à 09 h 09, heure de Paris", "soloAt909", 1, "◷"],
  ["9:09", "Terminer une grille solo en 9 min 09 s", "soloTime909", 1, "ϟ"],
  ["Neuf vies", "Terminer 9 grilles maître", "master", 9, "✺"],
  ["Dernière seconde", "Terminer une grille solo entre 23 h 59 et minuit, heure de Paris", "soloAt2359", 1, "◴"],
  ["Nouveau jour", "Terminer une grille solo entre minuit et 00 h 01, heure de Paris", "soloAt0000", 1, "☼"],
  ["Neuvième cercle", "Terminer 81 grilles solo", "solo", 81, "◎"],
  ["Rituel neuf", "Réussir 9 quotidiennes consécutives", "dailyStreak", 9, "✳"],
  ["Esprit clair", "Terminer 25 grilles expertes", "expert", 25, "◈"],
  ["Seconde volée", "Terminer 50 grilles en moins de 5 min", "fast5", 50, "ϟ"],
  ["À une case près", "Remporter 3 duels classés à 1 case d'écart", "rankedClose", 3, "◇"],
  ["Battement", "Gagner 15 duels classés consécutifs", "rankedStreak", 15, "♡"],
  ["Phénix", "Gagner 10 fois avec au moins 10 cases d'avance", "rankedWide", 10, "✹"],
  ["Final parfait", "Terminer 50 quotidiennes sans erreur", "dailyClean", 50, "✷"],
  ["Miroir", "Affronter 30 adversaires classés différents", "opponents", 30, "◈"],
  ["Rivalité", "Gagner 75 duels classés", "wins", 75, "⚔"],
  ["Résilience", "Jouer 250 duels classés", "ranked", 250, "⬡"],
  ["Ascension", "Gagner 25 duels classés sans erreur", "rankedCleanWins", 25, "▲"],
  ["Double défi", "Réussir la quotidienne et l’hebdomadaire le même jour", "doubleChallengeDays", 1, "☯"],
  ["Semaine totale", "Réussir les 7 quotidiennes et l’hebdomadaire d’une même semaine", "perfectWeeks", 1, "✷"],
  ["Déclic", "Terminer une hebdomadaire en moins de 30 min", "weeklyFast30", 1, "✦"],
  ["Sept jours", "Terminer une grille solo pendant 7 jours consécutifs", "soloStreak", 7, "◷"],
  ["Caméléon", "Terminer 10 grilles maître sans erreur", "masterClean", 10, "❖"],
  ["Polyvalence", "Terminer une grille de chacune des 6 difficultés", "allDifficulties", 1, "◈"],
  ["Atelier", "Atteindre le niveau 40", "level", 40, "⚙"],
  ["Métamorphe", "Débloquer 50 cadres de défi visibles", "frames", 50, "✥"],
];
const legendary: Entry[] = [
  ["Soleil éternel", "Réussir 45 quotidiennes consécutives", "dailyStreak", 45, "☀"],
  ["Gardien des saisons", "Réussir 12 hebdomadaires consécutives", "weeklyStreak", 12, "◉"],
  ["Perfection", "Terminer 100 grilles solo sans erreur ni indice", "soloPerfect", 100, "◆"],
  ["Oracle", "Terminer 50 grilles expertes sans erreur", "expertClean", 50, "✹"],
  ["Grand maître", "Terminer 50 grilles maître sans erreur", "masterClean", 50, "♛"],
  ["Implacable", "Gagner 100 duels classés sans erreur", "rankedCleanWins", 100, "⚔"],
  ["Invaincu", "Gagner 25 parties classées consécutives", "rankedStreak", 25, "♛"],
  ["Renaissance", "Gagner 25 fois avec au moins 10 cases d'avance", "rankedWide", 25, "✹"],
  ["Destin", "Gagner 9 duels classés à 1 case d'écart", "rankedClose", 9, "✦"],
  ["Seigneur de l'arène", "Gagner 250 parties classées", "wins", 250, "♜"],
  ["Conquérant", "Affronter 100 adversaires classés différents", "opponents", 100, "✥"],
  ["Bâtisseur", "Jouer 600 parties classées", "ranked", 600, "⬡"],
  ["Roi de la semaine", "Terminer 20 hebdomadaires en moins de 30 min", "weeklyFast30", 20, "♛"],
  ["Étoile du jour", "Terminer 100 quotidiennes sans erreur", "dailyClean", 100, "✹"],
  ["Immortel du classement", "Atteindre 1 700 points classés", "points", 1700, "✺"],
  ["Rang suprême", "Atteindre 2 000 points classés", "points", 2000, "♛"],
  ["Dynastie", "Atteindre 2 500 points classés", "points", 2500, "♜"],
  ["Légende du cercle", "Ajouter 35 amis", "friends", 35, "♡"],
  ["Cent quatre-vingts jours", "Réussir 180 grilles quotidiennes", "daily", 180, "◷"],
  ["Grande saison", "Réussir 60 grilles hebdomadaires", "weekly", 60, "◉"],
  ["Musée vivant", "Débloquer 100 cadres visibles", "frames", 100, "▣"],
  ["Chasseur de secrets", "Débloquer les 25 cadres épiques", "epicFrames", 25, "✥"],
  ["Dernière pièce", "Débloquer 148 autres cadres de défis", "otherFrames", 148, "◇"],
  ["Collection absolue", "Débloquer les 149 autres cadres de défis", "otherFrames", 149, "✹"],
  ["Éclipse du neuf", "Réussir 52 hebdomadaires sans erreur", "weeklyClean", 52, "☯"],
];
// This collection is not listed in the public challenges view. Its catalogue
// and the owner's progress are served exclusively by the admin endpoint.
const majestic: Entry[] = [
  ["Couronne de l'aube", "Terminer 42 grilles solo", "solo", 42, "♔"],
  ["Diadème du novice", "Terminer 25 grilles débutant", "beginner", 25, "✧"],
  ["Couronne des prairies", "Terminer 75 grilles faciles", "easy", 75, "❀"],
  ["Sceptre d'équilibre", "Terminer 75 grilles intermédiaires", "medium", 75, "♛"],
  ["Trône de granit", "Terminer 75 grilles difficiles", "hard", 75, "◆"],
  ["Oracle d'ivoire", "Terminer 40 grilles expertes", "expert", 40, "✹"],
  ["Monarque des neuf", "Terminer 20 grilles maître", "master", 20, "♚"],
  ["Éclat irréprochable", "Terminer 40 grilles solo sans erreur ni indice", "soloPerfect", 40, "✦"],
  ["Voûte immaculée", "Terminer 80 grilles solo sans erreur", "soloClean", 80, "◇"],
  ["Esprit indépendant", "Terminer 90 grilles solo sans indice", "soloNoHint", 90, "✧"],
  ["Couronne du sablier", "Terminer 25 grilles solo en moins de 5 min", "fast5", 25, "◷"],
  ["Comète du temps", "Terminer 75 grilles solo en moins de 10 min", "fast10", 75, "✴"],
  ["Solstice", "Réussir 21 grilles quotidiennes", "daily", 21, "☼"],
  ["Étoile pure", "Réussir 40 quotidiennes sans erreur", "dailyClean", 40, "✺"],
  ["Ligne des jours", "Réussir 21 quotidiennes consécutives", "dailyStreak", 21, "⌁"],
  ["Parure des semaines", "Réussir 8 grilles hebdomadaires", "weekly", 8, "◈"],
  ["Nacre des semaines", "Réussir 15 hebdomadaires sans erreur", "weeklyClean", 15, "◉"],
  ["Règne des cycles", "Réussir 6 hebdomadaires consécutives", "weeklyStreak", 6, "✳"],
  ["Champion des arènes", "Jouer 125 parties classées", "ranked", 125, "⚔"],
  ["Couronne des vainqueurs", "Gagner 25 parties classées", "wins", 25, "♜"],
  ["Lame sans faille", "Gagner 10 parties classées sans erreur", "rankedCleanWins", 10, "✥"],
  ["Dynastie du duel", "Gagner 7 parties classées consécutives", "rankedStreak", 7, "♛"],
  ["Fil du destin", "Gagner 5 duels classés avec 1 case d'avance", "rankedClose", 5, "◇"],
  ["Atlas des rivaux", "Affronter 40 adversaires classés différents", "opponents", 40, "✥"],
  ["Ascendant", "Atteindre le niveau 25", "level", 25, "✶"],
];
export const achievementFrames = [
  { id: "challenge-mini-playground", name: "Petit génie", requirement: "Réussir 1 grille Mini 6×6 · Cadre Récréation", metric: "mini" as const, target: 1, rarity: "simple" as const, color: "#ff8aca", accent: "#63dcff", symbol: "🧸" },
  ...make(visible, "simple", "v"),
  ...make(epic, "epic", "e"),
  ...make(legendary, "legendary", "l"),
  ...make(majestic, "majestic", "m"),
  { id: "challenge-l-026", name: "Ascension divine", requirement: "Super méga défi : réussir 1 grille Killer", metric: "killer" as const, target: 1, rarity: "legendary" as const, color: "#ffe9a3", accent: "#b87d26", symbol: "☀" },
];
export type AchievementProgress = Record<Metric, number>;
export function earnedAchievements(progress: AchievementProgress, alreadyEarned:Iterable<string>=[]) {
  const earned=new Set(alreadyEarned);
  let changed=true;
  while(changed){
    changed=false;
    const visible=achievementFrames.filter(a=>a.rarity==="simple"&&earned.has(a.id)).length;
    const epic=achievementFrames.filter(a=>a.rarity==="epic"&&earned.has(a.id)).length;
    for(const a of achievementFrames){
      if(earned.has(a.id))continue;
      // The two original collection finales count their original 150 frames.
      const originalCount=[...earned].filter(id=>!id.startsWith("challenge-m-")&&id!=="challenge-l-026"&&id!=="challenge-mini-playground").length;
      const count=a.metric==="frames"?visible:a.metric==="epicFrames"?epic:a.metric==="otherFrames"?originalCount:progress[a.metric];
      if(count>=a.target){earned.add(a.id);changed=true}
    }
  }
  return achievementFrames.filter(a=>earned.has(a.id));
}
