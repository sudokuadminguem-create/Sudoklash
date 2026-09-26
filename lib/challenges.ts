import { env } from "cloudflare:workers";

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

export async function getChallengeConfig(kind: ChallengeKind) {
  const stored = await env.DB.prepare(
    "SELECT title, puzzle FROM challenge_settings WHERE challenge_type = ?",
  )
    .bind(kind)
    .first<{ title: string; puzzle: string }>();
  return stored ?? challengeDefaults[kind];
}
