import { env } from "cloudflare:workers";
import { getAdminUser } from "@/app/admin/auth";
import { getSiteUser } from "@/app/supabase-auth";
import { achievementFrames } from "@/lib/achievement-frames";
import { playerAchievements } from "@/lib/achievement-awards";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  // Keep the undiscovered catalogue server-side for everyone but the owner.
  if (!(await getAdminUser(request))) return Response.json({ error: "not_found" }, { status: 404 });
  const user = await getSiteUser(request);
  if (!user || !env.DB) return Response.json({ error: "unavailable" }, { status: 503 });
  try {
    const rating = await env.DB.prepare("SELECT points FROM ranked_ratings WHERE user_id=?")
      .bind(user.userId).first<{ points: number }>();
    const { progress, ids } = await playerAchievements(env.DB, user.userId, rating?.points ?? 0);
    return Response.json({
      achievements: achievementFrames.filter(a => a.rarity === "majestic").map(a => ({
        ...a,
        progress: progress[a.metric],
        unlocked: ids.has(a.id),
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
