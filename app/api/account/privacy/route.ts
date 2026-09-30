import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";
import { bearerToken, supabaseUrl, verifySupabaseToken } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const serviceKey = () =>
  (env as unknown as { SUPABASE_SERVICE_ROLE_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  const user = await verifySupabaseToken(bearerToken(request));
  if (!user) return json({ error: "authentication_required" }, 401);
  return json({
    email: user.email ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    emailConfirmed: !!user.email_confirmed_at,
    providers: user.identities?.map((identity) => identity.provider) ?? [],
    deletionAvailable: !!serviceKey() && !!env.DB,
  });
}

/** Removes personal records while preserving anonymised results for other players. */
export async function deletePlayerData(db: D1Database, userId: string) {
  const anonymous = `deleted:${crypto.randomUUID()}`;
  const statements = [
    "daily_attempts",
    "weekly_attempts",
    "cosmetic_purchases",
    "achievement_unlocks",
    "solo_results",
    "solo_games",
    "player_avatar_images",
    "player_cosmetics",
    "ranked_queue",
    "ranked_ratings",
    "player_profiles",
  ].map((table) => db.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(userId));
  statements.push(
    db
      .prepare("DELETE FROM friendships WHERE requester_id=? OR addressee_id=?")
      .bind(userId, userId),
  );
  statements.push(
    db
      .prepare(
        "UPDATE ranked_matches SET player1_id=CASE WHEN player1_id=?1 THEN ?2 ELSE player1_id END, player2_id=CASE WHEN player2_id=?1 THEN ?2 ELSE player2_id END, winner_id=CASE WHEN winner_id=?1 THEN ?2 ELSE winner_id END, status=CASE WHEN status='playing' THEN 'cancelled' ELSE status END WHERE player1_id=?1 OR player2_id=?1",
      )
      .bind(userId, anonymous),
  );
  statements.push(
    db
      .prepare(
        "UPDATE friend_duels SET challenger_id=CASE WHEN challenger_id=?1 THEN ?2 ELSE challenger_id END, opponent_id=CASE WHEN opponent_id=?1 THEN ?2 ELSE opponent_id END, winner_id=CASE WHEN winner_id=?1 THEN ?2 ELSE winner_id END, status=CASE WHEN status IN ('playing','pending') THEN 'cancelled' ELSE status END WHERE challenger_id=?1 OR opponent_id=?1",
      )
      .bind(userId, anonymous),
  );
  await db.batch(statements);
}

export async function DELETE(request: Request) {
  const user = await verifySupabaseToken(bearerToken(request));
  if (!user) return json({ error: "authentication_required" }, 401);
  const body = (await request.json().catch(() => null)) as { confirmation?: string } | null;
  if (body?.confirmation !== "SUPPRIMER") return json({ error: "confirmation_required" }, 400);
  const key = serviceKey();
  if (!key || !env.DB) return json({ error: "deletion_unavailable" }, 503);
  const admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: "deletion_failed" }, 502);
  try {
    await deletePlayerData(env.DB, user.id);
  } catch {
    console.error("Account deletion requires data cleanup", user.id);
    return json({ error: "cleanup_required" }, 500);
  }
  return json({ deleted: true });
}
