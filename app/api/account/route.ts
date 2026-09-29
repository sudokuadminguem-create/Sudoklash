import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { streakOf } from "@/lib/player-stats";
import { rankedPosition } from "@/lib/ranked-position";
import { rankFor } from "@/lib/ranked-rules";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const db = env.DB;
  if (!db) return Response.json({ error: "stats_unavailable" }, { status: 503 });
  try {
    const [
      profile,
      solo,
      daily,
      weekly,
      recent,
      ranked,
      bestByDifficulty,
      byDifficulty,
      history,
      activity,
    ] = await Promise.all([
      db
        .prepare("SELECT username, created_at FROM player_profiles WHERE user_id = ?")
        .bind(user.userId)
        .first<{ username: string; created_at: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS games, MIN(elapsed_seconds) AS best, SUM(elapsed_seconds) AS total FROM solo_results WHERE user_id = ?",
        )
        .bind(user.userId)
        .first<{ games: number; best: number | null; total: number | null }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS completed FROM daily_attempts WHERE user_id = ? AND completed_at IS NOT NULL",
        )
        .bind(user.userId)
        .first<{ completed: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS completed FROM weekly_attempts WHERE user_id = ? AND completed_at IS NOT NULL",
        )
        .bind(user.userId)
        .first<{ completed: number }>(),
      db
        .prepare(
          "SELECT difficulty, elapsed_seconds, completed_at FROM solo_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 5",
        )
        .bind(user.userId)
        .all<{ difficulty: string; elapsed_seconds: number; completed_at: number }>(),
      db
        .prepare("SELECT points, wins, losses FROM ranked_ratings WHERE user_id = ?")
        .bind(user.userId)
        .first<{ points: number; wins: number; losses: number }>(),
      db
        .prepare(
          "SELECT difficulty, MIN(elapsed_seconds) AS best FROM solo_results WHERE user_id = ? GROUP BY difficulty",
        )
        .bind(user.userId)
        .all<{ difficulty: string; best: number }>(),
      db
        .prepare(
          "SELECT difficulty, COUNT(*) AS games, MIN(elapsed_seconds) AS best, ROUND(AVG(elapsed_seconds)) AS average FROM solo_results WHERE user_id = ? GROUP BY difficulty",
        )
        .bind(user.userId)
        .all<{ difficulty: string; games: number; best: number; average: number }>(),
      db
        .prepare(
          "SELECT difficulty, elapsed_seconds, completed_at FROM solo_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 200",
        )
        .bind(user.userId)
        .all<{ difficulty: string; elapsed_seconds: number; completed_at: number }>(),
      db
        .prepare(
          `SELECT completed_at FROM (
             SELECT completed_at FROM solo_results WHERE user_id = ?1
             UNION ALL SELECT completed_at FROM daily_attempts WHERE user_id = ?1 AND completed_at IS NOT NULL
             UNION ALL SELECT completed_at FROM weekly_attempts WHERE user_id = ?1 AND completed_at IS NOT NULL
           ) ORDER BY completed_at DESC LIMIT 3000`,
        )
        .bind(user.userId)
        .all<{ completed_at: number }>(),
    ]);
    const points = ranked?.points ?? 0;
    const position = await rankedPosition(db, user.userId, points);
    return Response.json(
      {
        profile,
        solo: solo ?? { games: 0, best: null, total: null },
        daily: daily?.completed ?? 0,
        weekly: weekly?.completed ?? 0,
        recent: recent.results,
        bestByDifficulty: bestByDifficulty.results,
        byDifficulty: byDifficulty.results,
        // Oldest first, so the browser can plot it as it is.
        history: history.results.slice().reverse(),
        streak: streakOf(
          activity.results.map((row) => row.completed_at),
          Date.now(),
        ),
        ranked: {
          points,
          wins: ranked?.wins ?? 0,
          losses: ranked?.losses ?? 0,
          rank: rankFor(points, position).label,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "stats_unavailable" }, { status: 503 });
  }
}
