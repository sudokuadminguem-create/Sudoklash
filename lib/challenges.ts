import { env } from "cloudflare:workers";
import type { Difficulty } from "@/lib/difficulties";
import { puzzleForPeriod } from "@/lib/puzzle-picker";
import { periodPuzzle } from "./challenge-schedule";

export type ChallengeKind = "daily" | "weekly";

export const challengeDefaults: Record<ChallengeKind, { title: string; puzzle: string }> = {
  daily: {
    title: "Le Sprint du jour",
    puzzle: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  },
  weekly: {
    title: "La Spirale",
    puzzle: "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
  },
};

/** Difficulty of the bank puzzles used when the admin has not chosen a grid. */
const bankDifficulty: Record<ChallengeKind, Difficulty> = { daily: "Facile", weekly: "Difficile" };

async function storedChallenge(kind: ChallengeKind) {
  return env.DB!.prepare("SELECT title, puzzle FROM challenge_settings WHERE challenge_type = ?")
    .bind(kind)
    .first<{ title: string; puzzle: string }>();
}

export async function getChallengeConfig(kind: ChallengeKind) {
  return (await storedChallenge(kind)) ?? challengeDefaults[kind];
}

/**
 * Grid of a period: the admin's grid when one is set, otherwise a new bank puzzle for each
 * period. Either way it is shuffled by symmetry for the period.
 */
export async function getPeriodChallenge(kind: ChallengeKind, periodId: string) {
  const stored = await storedChallenge(kind);
  const title = stored?.title ?? challengeDefaults[kind].title;
  const base = stored?.puzzle ?? puzzleForPeriod(bankDifficulty[kind], `${kind}:${periodId}`);
  return { title, puzzle: periodPuzzle(base, kind, periodId) };
}
