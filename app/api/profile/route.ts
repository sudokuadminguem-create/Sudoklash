import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  try {
    const row = await env.DB.prepare(
      "SELECT user_id, username FROM player_profiles WHERE user_id = ?",
    )
      .bind(user.userId)
      .first<{ user_id: string; username: string }>();
    return Response.json(
      {
        profile: row
          ? {
              id: row.user_id,
              username: row.username,
              display_name: row.username,
              avatar_url: null,
              last_seen: new Date().toISOString(),
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "profile_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { username?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
    return Response.json({ error: "invalid_username" }, { status: 400 });
  try {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO player_profiles (user_id, username, username_key, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(user.userId, username, username.toLowerCase(), Date.now())
      .run();
    const row = await env.DB.prepare(
      "SELECT user_id, username FROM player_profiles WHERE user_id = ?",
    )
      .bind(user.userId)
      .first<{ user_id: string; username: string }>();
    if (!row) return Response.json({ error: "username_unavailable" }, { status: 409 });
    return Response.json({
      profile: {
        id: row.user_id,
        username: row.username,
        display_name: row.username,
        avatar_url: null,
        last_seen: new Date().toISOString(),
      },
    });
  } catch {
    return Response.json({ error: "profile_unavailable" }, { status: 503 });
  }
}
