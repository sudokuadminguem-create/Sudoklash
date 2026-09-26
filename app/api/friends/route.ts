import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";

type FriendRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  username: string;
};

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
          "SELECT user_id AS id, username FROM player_profiles WHERE user_id != ? AND INSTR(username_key, ?) > 0 ORDER BY username_key LIMIT 51 OFFSET ?",
        )
        .bind(user.userId, search, offset)
        .all<{ id: string; username: string }>(),
      db
        .prepare(
          "SELECT f.id, f.requester_id, f.addressee_id, f.status, p.username FROM friendships f JOIN player_profiles p ON p.user_id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END WHERE f.requester_id = ? OR f.addressee_id = ? ORDER BY f.created_at DESC",
        )
        .bind(user.userId, user.userId, user.userId)
        .all<FriendRow>(),
    ]);
    const players = profiles.results.slice(0, 50);
    return Response.json(
      {
        players,
        nextOffset: profiles.results.length > 50 ? offset + 50 : null,
        relationships: relationships.results,
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
