import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { achievementFrames } from "@/lib/achievement-frames";
import { playerAchievements } from "@/lib/achievement-awards";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!env.DB) return Response.json({ error: "achievements_unavailable" }, { status: 503 });
  try {
    const rating = await env.DB.prepare("SELECT points FROM ranked_ratings WHERE user_id=?")
      .bind(user.userId)
      .first<{ points: number }>();
    const {progress,ids:earned,newAwards,visibleCount,epicCount}=await playerAchievements(env.DB,user.userId,rating?.points??0);
    return Response.json(
      {
        achievements: achievementFrames
          .filter((a) => a.rarity !== "majestic")
          .map((a) => ({
            ...a,
            progress:a.metric==="frames"?visibleCount:a.metric==="epicFrames"?epicCount:a.metric==="otherFrames"?[...earned].filter(id=>!id.startsWith("challenge-m-")).length-(earned.has(a.id)?1:0):progress[a.metric],
            unlocked: earned.has(a.id),
          })),
        visibleTotal: 100,
        secretUnlocked: [...earned].filter((id) => id.startsWith("challenge-e-") || id.startsWith("challenge-l-")).length,
        newlyUnlocked:newAwards,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json({ error: "achievements_unavailable" }, { status: 503 });
  }
}
