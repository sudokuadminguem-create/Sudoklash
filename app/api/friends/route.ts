import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { rankFor } from "@/lib/ranked-rules";
import { rankedPosition } from "@/lib/ranked-position";

export const dynamic = "force-dynamic";

type FriendRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  username: string;
  other_user_id: string;
  avatar_id: string | null;
  frame_id: string | null;
  points: number | null;
  image_data: string | null;
};

type PlayerRow = {
  id: string;
  username: string;
  avatar_id: string | null;
  frame_id: string | null;
  image_owner: string | null;
  points: number | null;
};

async function appearance(db: D1Database, userId: string, frameId: string | null, points: number | null) {
  if (frameId && frameId !== "rank_auto") return frameId;
  const value = points ?? 0;
  return `rank-${rankFor(value, await rankedPosition(db, userId, value)).name}`;
}

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const db = env.DB;
  if (!db) return Response.json({ error: "friends_unavailable" }, { status: 503 });
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 20).toLowerCase();
  const offset = Math.min(
    10000,
    Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0)),
  );
  try {
    const [profiles, relationships] = await Promise.all([
      db
        .prepare(
          "SELECT p.user_id AS id, p.username, c.avatar_id, c.frame_id, i.user_id AS image_owner, r.points FROM player_profiles p LEFT JOIN player_cosmetics c ON c.user_id=p.user_id LEFT JOIN player_avatar_images i ON i.user_id=p.user_id LEFT JOIN ranked_ratings r ON r.user_id=p.user_id WHERE p.user_id != ? AND INSTR(p.username_key, ?) > 0 ORDER BY p.username_key LIMIT 51 OFFSET ?",
        )
        .bind(user.userId, search, offset)
        .all<PlayerRow>(),
      db
        .prepare(
          "SELECT f.id, f.requester_id, f.addressee_id, f.status, p.user_id AS other_user_id, p.username, c.avatar_id, c.frame_id, i.image_data, r.points FROM friendships f JOIN player_profiles p ON p.user_id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END LEFT JOIN player_cosmetics c ON c.user_id=p.user_id LEFT JOIN player_avatar_images i ON i.user_id=p.user_id LEFT JOIN ranked_ratings r ON r.user_id=p.user_id WHERE f.requester_id = ? OR f.addressee_id = ? ORDER BY f.created_at DESC",
        )
        .bind(user.userId, user.userId, user.userId)
        .all<FriendRow>(),
    ]);
    const players = await Promise.all(profiles.results.slice(0, 50).map(async (row) => ({
      id: row.id,
      username: row.username,
      avatarId: row.avatar_id ?? "nova",
      frameId: await appearance(db, row.id, row.frame_id, row.points),
      image: null,
    })));
    const friends = await Promise.all(relationships.results.map(async (row) => ({
      id: row.id,
      requester_id: row.requester_id,
      addressee_id: row.addressee_id,
      status: row.status,
      username: row.username,
      otherUserId: row.other_user_id,
      avatarId: row.avatar_id ?? "nova",
      frameId: await appearance(db, row.other_user_id, row.frame_id, row.points),
      image: row.status === "accepted" && row.avatar_id === "custom" ? row.image_data : null,
    })));
    return Response.json(
      {
        players,
        nextOffset: profiles.results.length > 50 ? offset + 50 : null,
        relationships: friends,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "friends_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const db = env.DB;
  if (!db) return Response.json({ error: "friends_unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    username?: string;
    id?: string;
  } | null;
  if (!body || !["send", "accept", "decline"].includes(body.action ?? ""))
    return Response.json({ error: "invalid_action" }, { status: 400 });
  try {
    if (body.action === "send") {
      const username = body.username?.trim().toLowerCase();
      if (!username || username.length > 20)
        return Response.json({ error: "invalid_username" }, { status: 400 });
      const target = await db
        .prepare("SELECT user_id FROM player_profiles WHERE username_key = ?")
        .bind(username)
        .first<{ user_id: string }>();
      if (!target) return Response.json({ error: "player_not_found" }, { status: 404 });
      if (target.user_id === user.userId)
        return Response.json({ error: "self_request" }, { status: 400 });
      const pairKey = [user.userId, target.user_id].sort().join(":");
      const existing = await db
        .prepare("SELECT id, requester_id, status FROM friendships WHERE pair_key = ?")
        .bind(pairKey)
        .first<{ id: string; requester_id: string; status: string }>();
      if (existing?.status === "accepted")
        return Response.json({ error: "already_friends" }, { status: 409 });
      if (existing?.status === "pending")
        return Response.json(
          { error: existing.requester_id === user.userId ? "request_pending" : "incoming_request" },
          { status: 409 },
        );
      if (existing)
        await db
          .prepare(
            "UPDATE friendships SET requester_id = ?, addressee_id = ?, status = 'pending', created_at = ? WHERE id = ?",
          )
          .bind(user.userId, target.user_id, Date.now(), existing.id)
          .run();
      else
        await db
          .prepare(
            "INSERT INTO friendships (id, pair_key, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
          )
          .bind(crypto.randomUUID(), pairKey, user.userId, target.user_id, Date.now())
          .run();
      return Response.json({ ok: true });
    }
    if (!body.id || typeof body.id !== "string")
      return Response.json({ error: "invalid_request" }, { status: 400 });
    const status = body.action === "accept" ? "accepted" : "declined";
    const result = await db
      .prepare(
        "UPDATE friendships SET status = ? WHERE id = ? AND addressee_id = ? AND status = 'pending'",
      )
      .bind(status, body.id, user.userId)
      .run();
    if (!result.meta.changes) return Response.json({ error: "request_not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "friends_unavailable" }, { status: 503 });
  }
}
