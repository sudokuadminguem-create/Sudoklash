import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { colorTier, type InvitationState } from "@/lib/invitations";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

const completedInviteCount = `SELECT COUNT(*) AS count FROM player_profiles p WHERE p.invited_by=? AND (
  EXISTS (SELECT 1 FROM solo_results WHERE user_id=p.user_id)
  OR EXISTS (SELECT 1 FROM daily_attempts WHERE user_id=p.user_id AND completed_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM weekly_attempts WHERE user_id=p.user_id AND completed_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM tournament_entries WHERE user_id=p.user_id AND finished_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM ranked_matches WHERE (player1_id=p.user_id OR player2_id=p.user_id)
             AND winner_id=p.user_id AND finish_reason='completed')
  OR EXISTS (SELECT 1 FROM friend_duels WHERE (challenger_id=p.user_id OR opponent_id=p.user_id)
             AND winner_id=p.user_id AND finish_reason='completed')
  OR EXISTS (SELECT 1 FROM private_room_players member JOIN private_rooms room ON room.id=member.room_id
             WHERE member.user_id=p.user_id AND room.winner_id=p.user_id)
)`;

async function statusFor(db: D1Database, id: string): Promise<InvitationState | null> {
  const profile = await db
    .prepare("SELECT invite_code, username_color FROM player_profiles WHERE user_id=?")
    .bind(id)
    .first<{ invite_code: string | null; username_color: string | null }>();
  if (!profile) return null;
  let code = profile.invite_code;
  if (!code) {
    await db
      .prepare(
        "UPDATE player_profiles SET invite_code=?, invite_code_at=? WHERE user_id=? AND invite_code IS NULL",
      )
      // Provider account creation timestamps may be rounded to whole seconds.
      .bind(crypto.randomUUID(), Math.floor(Date.now() / 1000) * 1000, id)
      .run();
    code =
      (
        await db
          .prepare("SELECT invite_code FROM player_profiles WHERE user_id=?")
          .bind(id)
          .first<{ invite_code: string }>()
      )?.invite_code ?? null;
    if (!code) return null;
  }
  const [count, rewards] = await Promise.all([
    db.prepare(completedInviteCount).bind(id).first<{ count: number }>(),
    db
      .prepare("SELECT tier,color FROM invitation_rewards WHERE user_id=? ORDER BY tier")
      .bind(id)
      .all<{ tier: number; color: string }>(),
  ]);
  return {
    code,
    count: count?.count ?? 0,
    selected: profile.username_color,
    rewards: rewards.results,
  };
}

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!env.DB) return json({ error: "unavailable" }, 503);
  const status = await statusFor(env.DB, user.userId);
  return status ? json(status) : json({ error: "profile_required" }, 409);
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  const db = env.DB;
  if (!db) return json({ error: "unavailable" }, 503);
  const body = (await request.json().catch(() => null)) as { color?: unknown } | null;
  const color = body?.color;
  const tier = colorTier(color);
  const id = user.userId;
  if (color !== null && (!tier || typeof color !== "string"))
    return json({ error: "invalid_color" }, 400);
  if (tier) {
    const status = await statusFor(db, id);
    if (!status) return json({ error: "profile_required" }, 409);
    const picked = status.rewards.find((reward) => reward.tier === tier.count);
    if (picked && picked.color !== color) return json({ error: "already_chosen" }, 409);
    if (!picked && status.count < tier.count) return json({ error: "tier_locked" }, 403);
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO invitation_rewards (user_id,tier,color)
        SELECT user_id,?,? FROM player_profiles WHERE user_id=?`,
        )
        .bind(tier.count, color, id),
      db
        .prepare(
          `UPDATE player_profiles SET username_color=? WHERE user_id=?
        AND EXISTS (SELECT 1 FROM invitation_rewards WHERE user_id=? AND tier=? AND color=?)`,
        )
        .bind(color, id, id, tier.count, color),
    ]);
  } else {
    await db
      .prepare("UPDATE player_profiles SET username_color=NULL WHERE user_id=?")
      .bind(id)
      .run();
  }
  const status = await statusFor(db, id);
  return !status
    ? json({ error: "profile_required" }, 409)
    : status.selected !== color
      ? json({ error: "already_chosen" }, 409)
      : json(status);
}
