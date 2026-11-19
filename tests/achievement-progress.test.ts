import { describe, expect, it } from "vitest";
import { achievementProgress } from "@/lib/achievement-progress";

const ME = "me";
// 2026-11-18 at 09:09 in Paris (UTC+1 in November).
const at0909 = Date.UTC(2026, 10, 18, 8, 9);
const at2359 = Date.UTC(2026, 10, 19, 22, 59);

const solo = [
  {
    difficulty: "Maître",
    elapsed_seconds: 549,
    completed_at: at0909,
    mistakes: 0,
    hints_used: 0,
    variant: "killer",
  },
  {
    difficulty: "Débutant",
    elapsed_seconds: 1500,
    completed_at: at0909 + 60_000,
    mistakes: 2,
    hints_used: 0,
    variant: null,
  },
  {
    difficulty: "Facile",
    elapsed_seconds: 250,
    completed_at: at2359,
    mistakes: 0,
    hints_used: 1,
    variant: "mini",
  },
];
// Every day of the week of Monday 2026-11-16, all without mistakes.
const daily = Array.from({ length: 7 }, (_, i) => ({
  id: `2026-11-${16 + i}`,
  mistakes: 0,
  elapsed_seconds: i === 0 ? null : 500,
  completed_at: Date.UTC(2026, 10, 16 + i, 12),
}));
const weekly = [{ id: "2026-11-16", mistakes: 0, elapsed_seconds: 1700, completed_at: at0909 }];
const match = {
  difficulty: "Facile",
  player1_mistakes: 0,
  player2_mistakes: 3,
  player1_points_before: 100,
  player2_points_before: 120,
  player1_points_change: 20,
  player2_points_change: -20,
  started_at: 1,
};
const ranked = [
  // A wide win as player 1.
  {
    ...match,
    player1_id: ME,
    player2_id: "a",
    winner_id: ME,
    player1_progress: 81,
    player2_progress: 60,
  },
  // A close win as player 2, with mistakes.
  {
    ...match,
    difficulty: "Expert",
    player1_id: "b",
    player2_id: ME,
    winner_id: ME,
    player1_progress: 80,
    player2_progress: 81,
    player2_points_before: 120,
    player2_points_change: 25,
  },
  // A loss.
  {
    ...match,
    player1_id: ME,
    player2_id: "a",
    winner_id: "a",
    player1_progress: 50,
    player2_progress: 81,
  },
];

function fakeDb() {
  const rowsFor = (sql: string) => {
    if (sql.includes("FROM solo_results")) return solo;
    if (sql.includes("FROM daily_attempts")) return daily;
    if (sql.includes("FROM weekly_attempts")) return weekly;
    if (sql.includes("FROM ranked_matches")) return ranked;
    throw new Error(`unexpected query: ${sql}`);
  };
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        all: async () => ({ results: rowsFor(sql) }),
        first: async () => ({ n: 4 }),
      }),
    }),
  } as unknown as D1Database;
}

describe("achievementProgress", () => {
  it("counts solo, challenge and ranked achievements from the player's history", async () => {
    const p = await achievementProgress(fakeDb(), ME, 90);
    expect(p).toMatchObject({
      solo: 3,
      killer: 1,
      mini: 1,
      master: 1,
      beginner: 1,
      easy: 1,
      fast5: 1,
      fast10: 2,
      soloClean: 2,
      soloNoHint: 2,
      soloPerfect: 1,
      masterClean: 1,
      soloAt909: 1,
      soloTime909: 1,
      soloAt2359: 1,
      soloDays: 2,
      soloMaxDay: 2,
      soloBest: 250,
      allDifficulties: 0,
      daily: 7,
      dailyClean: 7,
      dailyStreak: 7,
      dailyCleanStreak: 7,
      dailyFast10: 6,
      weekly: 1,
      weeklyClean: 1,
      weeklyFast30: 1,
      perfectWeeks: 1,
      doubleChallengeDays: 1,
      ranked: 3,
      wins: 2,
      rankedStreak: 2,
      rankedWide: 1,
      rankedClose: 1,
      rankedCleanWins: 1,
      rankedEasyWins: 1,
      rankedExpertWins: 1,
      opponents: 2,
      friends: 4,
      points: 145,
    });
  });

  it("starts from zero without any history", async () => {
    const empty = {
      prepare: () => ({
        bind: () => ({ all: async () => ({ results: [] }), first: async () => null }),
      }),
    } as unknown as D1Database;
    const p = await achievementProgress(empty, ME, 0);
    expect(p).toMatchObject({ solo: 0, soloBest: 0, soloMaxDay: 0, friends: 0, points: 0 });
  });
});
