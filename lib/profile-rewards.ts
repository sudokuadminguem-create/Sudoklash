import type { AchievementProgress, Metric } from "./achievement-frames";

type Reward = {
  id: string;
  name: string;
  requirement: string;
  metric?: Metric;
  target?: number;
};

export const profileCards: Reward[] = [
  { id: "origin", name: "Origine", requirement: "Offerte dès la création du profil" },
  { id: "aurora", name: "Aurore", requirement: "Terminer 7 défis quotidiens", metric: "daily", target: 7 },
  { id: "arena", name: "Arène", requirement: "Gagner 5 parties classées", metric: "wins", target: 5 },
  { id: "obsidian", name: "Obsidienne", requirement: "Terminer 10 grilles expertes", metric: "expert", target: 10 },
  { id: "celestial", name: "Céleste", requirement: "Débloquer 1 cadre de défi épique", metric: "epicFrames", target: 1 },
];

export const profileTitles: Reward[] = [
  { id: "none", name: "Aucun sous-nom", requirement: "Disponible immédiatement" },
  { id: "flash", name: "Flash", requirement: "Terminer une grille solo en moins de 5 minutes", metric: "fast5", target: 1 },
  { id: "ingenious", name: "Ingénieux", requirement: "Terminer 5 grilles sans erreur ni indice", metric: "soloPerfect", target: 5 },
  { id: "expert", name: "Expert", requirement: "Terminer 10 grilles expertes", metric: "expert", target: 10 },
  { id: "duelist", name: "Duelliste", requirement: "Gagner 10 parties classées", metric: "wins", target: 10 },
  { id: "persistent", name: "Persévérant", requirement: "Terminer 50 grilles solo", metric: "solo", target: 50 },
];

export function unlockedRewards(rewards: Reward[], progress: AchievementProgress) {
  return rewards.filter((reward) => !reward.metric || progress[reward.metric] >= reward.target!);
}
