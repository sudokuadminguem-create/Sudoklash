import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
export async function GET() {
  const db = env.DB;
  if (!db) return Response.json({ error: "unavailable" }, { status: 503 });
  const result = await db.prepare(`SELECT p.username
    FROM premium_credits c JOIN player_profiles p ON p.user_id=c.user_id
    WHERE c.pack_id IN ('support-2','support-5','support-10')
    GROUP BY c.user_id,p.username
    ORDER BY SUM(c.amount_cents) DESC, MIN(c.credited_at) ASC, c.user_id ASC LIMIT 3`).all<{username:string}>();
  return Response.json({ supporters: result.results.map((r,index)=>({ username:r.username, place:index+1 })) },{ headers:{"Cache-Control":"no-store"} });
}
