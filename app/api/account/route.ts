import {env} from "cloudflare:workers";
import {getSiteUser} from "@/app/supabase-auth";
import {solvePuzzle} from "@/lib/challenges";
import {rankFor} from "@/lib/ranked-rules";

export const dynamic = "force-dynamic";
const difficulties = ["Débutant", "Facile", "Intermédiaire", "Difficile", "Expert", "Maître"];

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({error: "authentication_required"}, {status: 401});
  const db=env.DB;
  if (!db) return Response.json({error:"stats_unavailable"}, {status:503});
  try {
    const [profile, solo, daily, weekly, recent, ranked] = await Promise.all([
      db.prepare("SELECT username, created_at FROM player_profiles WHERE user_id = ?").bind(user.userId).first<{username:string;created_at:number}>(),
      db.prepare("SELECT COUNT(*) AS games, MIN(elapsed_seconds) AS best, SUM(elapsed_seconds) AS total FROM solo_results WHERE user_id = ?").bind(user.userId).first<{games:number;best:number|null;total:number|null}>(),
      db.prepare("SELECT COUNT(*) AS completed FROM daily_attempts WHERE user_id = ? AND completed_at IS NOT NULL").bind(user.userId).first<{completed:number}>(),
      db.prepare("SELECT COUNT(*) AS completed FROM weekly_attempts WHERE user_id = ? AND completed_at IS NOT NULL").bind(user.userId).first<{completed:number}>(),
      db.prepare("SELECT difficulty, elapsed_seconds, completed_at FROM solo_results WHERE user_id = ? ORDER BY completed_at DESC LIMIT 5").bind(user.userId).all<{difficulty:string;elapsed_seconds:number;completed_at:number}>(),
      db.prepare("SELECT points, wins, losses FROM ranked_ratings WHERE user_id = ?").bind(user.userId).first<{points:number;wins:number;losses:number}>(),
    ]);
    const points=ranked?.points??0;
    const position=points>=1700?(await db.prepare("SELECT COUNT(*) + 1 AS position FROM ranked_ratings WHERE points > ? OR (points = ? AND user_id < ?)").bind(points,points,user.userId).first<{position:number}>())?.position??null:null;
    return Response.json({profile, solo:solo??{games:0,best:null,total:null}, daily:daily?.completed??0, weekly:weekly?.completed??0, recent:recent.results, ranked:{points,wins:ranked?.wins??0,losses:ranked?.losses??0,rank:rankFor(points,position).label}}, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({error:"stats_unavailable"}, {status:503});
  }
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({error:"authentication_required"}, {status:401});
  const db=env.DB;
  if (!db) return Response.json({error:"stats_unavailable"}, {status:503});
  const body = await request.json().catch(() => null) as {difficulty?:unknown;elapsedSeconds?:unknown;puzzle?:unknown;grid?:unknown}|null;
  if (!body || !difficulties.includes(body.difficulty as string) || !Number.isInteger(body.elapsedSeconds) || (body.elapsedSeconds as number) < 1 || (body.elapsedSeconds as number) > 86400 || !Array.isArray(body.puzzle) || !Array.isArray(body.grid)) return Response.json({error:"invalid_result"}, {status:400});
  const puzzle=body.puzzle as unknown[], grid=body.grid as unknown[];
  if (puzzle.length!==81 || grid.length!==81 || puzzle.some(n=>!Number.isInteger(n)||Number(n)<0||Number(n)>9) || grid.some(n=>!Number.isInteger(n)||Number(n)<1||Number(n)>9) || puzzle.filter(Boolean).length<17) return Response.json({error:"invalid_grid"}, {status:400});
  const solved=solvePuzzle(puzzle.join(""));
  if (!solved || grid.some((n,i)=>n!==solved[i])) return Response.json({error:"invalid_grid"}, {status:422});
  try {
    await db.prepare("INSERT INTO solo_results (id, user_id, difficulty, elapsed_seconds, completed_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(),user.userId,body.difficulty,body.elapsedSeconds,Date.now()).run();
    return Response.json({saved:true});
  } catch {
    return Response.json({error:"stats_unavailable"}, {status:503});
  }
}
