import { env } from "cloudflare:workers";
import { rankFor } from "@/lib/ranked-rules";

export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  username: string;
  points: number;
  wins: number;
  losses: number;
  avatar_id: string | null;
  frame_id: string | null;
  image_owner: string | null;
};

export async function GET() {
  if (!env.DB) return Response.json({ error: "unavailable" }, { status: 503 });
  const rows = await env.DB.prepare(
    "SELECT r.user_id,r.points,r.wins,r.losses,COALESCE(p.username,'Joueur') AS username,c.avatar_id,c.frame_id,i.user_id AS image_owner FROM ranked_ratings r LEFT JOIN player_profiles p ON p.user_id=r.user_id LEFT JOIN player_cosmetics c ON c.user_id=r.user_id LEFT JOIN player_avatar_images i ON i.user_id=r.user_id ORDER BY r.points DESC,r.user_id ASC LIMIT 100",
  ).all<Row>();
  return Response.json(
    {
      players: rows.results.map((row, index) => {
        const rank = rankFor(row.points, index + 1);
        return {
          position: index + 1,
          username: row.username,
          points: row.points,
          wins: row.wins,
          losses: row.losses,
          rank,
          avatarId: row.avatar_id ?? "nova",
          frameId:
            row.frame_id && row.frame_id !== "rank_auto" ? row.frame_id : `rank-${rank.name}`,
          image:
            row.avatar_id === "custom" && row.image_owner
              ? `/api/players/avatar?id=${encodeURIComponent(row.user_id)}`
              : null,
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
