import { soloXpFor, type ProgressCounts } from "@/lib/cosmetics";

export async function counts(db: D1Database, userId: string): Promise<ProgressCounts> {
  const [solo, daily, weekly, rating] = await Promise.all([
    db
      .prepare(
        "SELECT difficulty, COUNT(*) AS n FROM solo_results WHERE user_id=? GROUP BY difficulty",
      )
      .bind(userId)
      .all<{ difficulty: string; n: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM daily_attempts WHERE user_id=? AND completed_at IS NOT NULL",
      )
      .bind(userId)
      .first<{ n: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM weekly_attempts WHERE user_id=? AND completed_at IS NOT NULL",
      )
      .bind(userId)
      .first<{ n: number }>(),
    db
      .prepare("SELECT wins,losses FROM ranked_ratings WHERE user_id=?")
      .bind(userId)
      .first<{ wins: number; losses: number }>(),
  ]);
  return {
    solo: solo.results.reduce((total, row) => total + row.n, 0),
    soloXp: solo.results.reduce((total, row) => total + row.n * soloXpFor(row.difficulty), 0),
    daily: daily?.n ?? 0,
    weekly: weekly?.n ?? 0,
    wins: rating?.wins ?? 0,
    losses: rating?.losses ?? 0,
  };
}
