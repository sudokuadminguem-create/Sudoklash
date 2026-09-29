import { env } from "cloudflare:workers";
import { rankFor } from "@/lib/ranked-rules";
import { rankedPosition } from "@/lib/ranked-position";

export const dynamic = "force-dynamic";

type Appearance = {
  user_id: string;
  avatar_id: string | null;
  frame_id: string | null;
  image_owner: string | null;
  points: number | null;
};

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(","))];
  if (!ids.length || ids.length > 10 || ids.some((id) => !/^[a-f0-9-]{36}$/i.test(id)))
    return Response.json({ error: "invalid_ids" }, { status: 400 });
  const db = env.DB;
  if (!db) return Response.json({ error: "unavailable" }, { status: 503 });
  const rows = await db.prepare(`SELECT p.user_id, c.avatar_id, c.frame_id, i.user_id AS image_owner, r.points FROM player_profiles p LEFT JOIN player_cosmetics c ON c.user_id=p.user_id LEFT JOIN player_avatar_images i ON i.user_id=p.user_id LEFT JOIN ranked_ratings r ON r.user_id=p.user_id WHERE p.user_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<Appearance>();
  const appearances = await Promise.all(rows.results.map(async (row) => {
    const points = row.points ?? 0;
    return {
      id: row.user_id,
      avatarId: row.avatar_id ?? "nova",
      frameId: row.frame_id && row.frame_id !== "rank_auto" ? row.frame_id : `rank-${rankFor(points, await rankedPosition(db, row.user_id, points)).name}`,
      image: row.avatar_id === "custom" && row.image_owner ? `/api/players/avatar?id=${encodeURIComponent(row.user_id)}` : null,
    };
  }));
  return Response.json({ appearances }, { headers: { "Cache-Control": "no-store" } });
}
