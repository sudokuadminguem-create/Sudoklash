import { env } from "cloudflare:workers";
import { getAdminUser } from "@/app/admin/auth";
import { challengeDefaults, getChallengeConfig, hasUniqueSolution, type ChallengeKind } from "@/lib/challenges";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await getAdminUser(request)) return Response.json({ error: "not_found" }, { status: 404 });
  const [daily,weekly] = await Promise.all([getChallengeConfig("daily"),getChallengeConfig("weekly")]);
  return Response.json({ daily, weekly }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await getAdminUser(request)) return Response.json({ error: "not_found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { kind?: ChallengeKind; title?: unknown; puzzle?: unknown } | null;
  if (!body || (body.kind !== "daily" && body.kind !== "weekly")) return Response.json({ error: "invalid_kind" }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  const puzzle = typeof body.puzzle === "string" ? body.puzzle.replace(/\s/g, "") : "";
  if (!title) return Response.json({ error: "missing_title" }, { status: 400 });
  if (!hasUniqueSolution(puzzle)) return Response.json({ error: "invalid_puzzle" }, { status: 400 });
  await env.DB.prepare(
    "INSERT INTO challenge_settings (challenge_type, title, puzzle, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(challenge_type) DO UPDATE SET title = excluded.title, puzzle = excluded.puzzle, updated_at = excluded.updated_at",
  ).bind(body.kind, title, puzzle, Date.now()).run();
  return Response.json({ ok: true, value: { title, puzzle }, default: challengeDefaults[body.kind] });
}
