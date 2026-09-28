import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { rankedPosition } from "@/lib/ranked-position";
import { rankFor } from "@/lib/ranked-rules";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const db = env.DB;
  if (!db) return Response.json({ error: "profile_unavailable" }, { status: 503 });
  const friendId = new URL(request.url).searchParams.get("id");
  if (!friendId || friendId.length > 100) return Response.json({ error: "invalid_friend" }, { status: 400 });

  try {
    const friendship = await db.prepare(
      "SELECT id FROM friendships WHERE status='accepted' AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?))",
    ).bind(user.userId, friendId, friendId, user.userId).first();
    if (!friendship) return Response.json({ error: "not_a_friend" }, { status: 403 });

    const [profile, cosmetics, image, solo, challenges, ranked, bestByDifficulty] = await Promise.all([
      db.prepare("SELECT username FROM player_profiles WHERE user_id=?").bind(friendId).first<{ username: string }>(),
      db.prepare("SELECT avatar_id,frame_id,profile_card_id,profile_title_id FROM player_cosmetics WHERE user_id=?")
        .bind(friendId).first<{ avatar_id: string; frame_id: string; profile_card_id: string; profile_title_id: string }>(),
      db.prepare("SELECT image_data FROM player_avatar_images WHERE user_id=?").bind(friendId).first<{ image_data: string }>(),
      db.prepare("SELECT COUNT(*) AS games FROM solo_results WHERE user_id=?").bind(friendId).first<{ games: number }>(),
      db.prepare("SELECT (SELECT COUNT(*) FROM daily_attempts WHERE user_id=? AND completed_at IS NOT NULL) AS daily, (SELECT COUNT(*) FROM weekly_attempts WHERE user_id=? AND completed_at IS NOT NULL) AS weekly")
        .bind(friendId, friendId).first<{ daily: number; weekly: number }>(),
      db.prepare("SELECT points,wins FROM ranked_ratings WHERE user_id=?").bind(friendId).first<{ points: number; wins: number }>(),
      db.prepare("SELECT difficulty,MIN(elapsed_seconds) AS best FROM solo_results WHERE user_id=? GROUP BY difficulty")
        .bind(friendId).all<{ difficulty: string; best: number }>(),
    ]);
    if (!profile) return Response.json({ error: "player_not_found" }, { status: 404 });
    const points = ranked?.points ?? 0;
    const rank = rankFor(points, await rankedPosition(db, friendId, points));
    return Response.json({
      username: profile.username,
      avatarId: cosmetics?.avatar_id ?? "nova",
      frameId: cosmetics?.frame_id && cosmetics.frame_id !== "rank_auto" ? cosmetics.frame_id : `rank-${rank.name}`,
      image: image?.image_data ?? null,
      profileCardId: cosmetics?.profile_card_id ?? "origin",
      profileTitleId: cosmetics?.profile_title_id ?? "none",
      solo: { games: solo?.games ?? 0 },
      daily: challenges?.daily ?? 0,
      weekly: challenges?.weekly ?? 0,
      ranked: { points, wins: ranked?.wins ?? 0, rank: rank.label },
      bestByDifficulty: bestByDifficulty.results,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "profile_unavailable" }, { status: 503 });
  }
}
