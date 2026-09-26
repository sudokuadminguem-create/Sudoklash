import { MASTER_MIN_POINTS } from "@/lib/ranked-rules";

/**
 * Leaderboard position of a player, only computed when it can matter for the Maître rank.
 * Ties are broken by user id, like the leaderboard itself.
 */
export async function rankedPosition(db: D1Database, userId: string, points: number) {
  if (points < MASTER_MIN_POINTS) return null;
  const row = await db
    .prepare(
      "SELECT COUNT(*) + 1 AS position FROM ranked_ratings WHERE points > ? OR (points = ? AND user_id < ?)",
    )
    .bind(points, points, userId)
    .first<{ position: number }>();
  return row?.position ?? null;
}
