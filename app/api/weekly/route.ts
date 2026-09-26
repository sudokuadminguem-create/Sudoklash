import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { getPeriodChallenge, solvePuzzle } from "@/lib/challenges";
import {challengeWindow} from "@/lib/challenge-schedule";

export const dynamic = "force-dynamic";

type AttemptRow = {
  started_at: number;
  completed_at: number | null;
  elapsed_seconds: number | null;
  mistakes: number;
  last_mistake_id: string | null;
  puzzle: string | null;
};

async function currentAttempt(userId: string, weekId: string) {
  if (!env.DB) throw new Error("database_unavailable");
  return env.DB.prepare(
    "SELECT started_at, completed_at, elapsed_seconds, mistakes, last_mistake_id, puzzle FROM weekly_attempts WHERE user_id = ? AND week_id = ?",
  ).bind(userId, weekId).first<AttemptRow>();
}

function payload(attempt: AttemptRow | null, nextAt: string, config: {title:string;puzzle:string}) {
  const status = attempt?.completed_at
    ? "completed"
    : (attempt?.mistakes ?? 0) >= 3
      ? "failed"
    : attempt
      ? "in_progress"
      : "not_started";
  return {
    status,
    title: config.title,
    puzzle: (attempt?.puzzle ?? config.puzzle).split("").map(Number),
    nextAt,
    startedAt: attempt ? new Date(attempt.started_at).toISOString() : null,
    elapsedSeconds: attempt?.elapsed_seconds ?? null,
    mistakes: attempt?.mistakes ?? 0,
  };
}

export async function GET(request:Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  if (!env.DB) return Response.json({ error: "database_unavailable" }, { status: 503 });

  const { periodId:weekId, nextAt } = challengeWindow("weekly");
  const [attempt,config] = await Promise.all([currentAttempt(user.userId, weekId),getPeriodChallenge("weekly",weekId)]);
  return Response.json(payload(attempt, nextAt, config), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
  const db = env.DB;
  if (!db) return Response.json({ error: "database_unavailable" }, { status: 503 });

  const body = await request.json().catch(() => null) as { action?: string; grid?: unknown; index?: unknown; number?: unknown; mistakeId?: unknown } | null;
  const { periodId:weekId, nextAt } = challengeWindow("weekly");
  const now = Date.now();
  const config = await getPeriodChallenge("weekly",weekId);

  if (body?.action === "ready") {
    await db.prepare(
      "INSERT OR IGNORE INTO weekly_attempts (user_id, week_id, started_at, puzzle, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(user.userId, weekId, now, config.puzzle, now).run();
    return Response.json(payload(await currentAttempt(user.userId, weekId), nextAt, config));
  }

  if (body?.action === "mistake") {
    const attempt = await currentAttempt(user.userId, weekId);
    if (!attempt) return Response.json({ error: "not_started" }, { status: 409 });
    if (attempt.completed_at || attempt.mistakes >= 3) return Response.json(payload(attempt, nextAt, config));
    const index = body.index, number = body.number, mistakeId = body.mistakeId;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= 81 || !Number.isInteger(number) || (number as number) < 1 || (number as number) > 9 || typeof mistakeId !== "string" || !/^[a-f0-9-]{36}$/.test(mistakeId)) return Response.json({ error: "invalid_mistake" }, { status: 400 });
    const puzzle = attempt.puzzle ?? config.puzzle;
    const solution = solvePuzzle(puzzle);
    if (puzzle[index as number] !== "0" || !solution || solution[index as number] === number) return Response.json({ error: "invalid_mistake" }, { status: 422 });
    await db.prepare("UPDATE weekly_attempts SET mistakes = mistakes + 1, last_mistake_id = ? WHERE user_id = ? AND week_id = ? AND completed_at IS NULL AND mistakes < 3 AND (last_mistake_id IS NULL OR last_mistake_id != ?)")
      .bind(mistakeId, user.userId, weekId, mistakeId).run();
    return Response.json(payload(await currentAttempt(user.userId, weekId), nextAt, config));
  }

  if (body?.action === "complete") {
    const attempt = await currentAttempt(user.userId, weekId);
    if (!attempt) return Response.json({ error: "not_started" }, { status: 409 });
    if (attempt.completed_at || attempt.mistakes >= 3) return Response.json(payload(attempt, nextAt, config));

    const grid = Array.isArray(body.grid) ? body.grid : [];
    const solution = solvePuzzle(attempt.puzzle ?? config.puzzle);
    const valid = solution && grid.length === 81 && grid.every((value, index) => value === solution[index]);
    if (!valid) return Response.json({ error: "invalid_solution" }, { status: 422 });

    const elapsed = Math.max(1, Math.floor((now - attempt.started_at) / 1000));
    await db.prepare(
      "UPDATE weekly_attempts SET completed_at = ?, elapsed_seconds = ? WHERE user_id = ? AND week_id = ? AND completed_at IS NULL AND mistakes < 3",
    ).bind(now, elapsed, user.userId, weekId).run();
    return Response.json(payload(await currentAttempt(user.userId, weekId), nextAt, config));
  }

  return Response.json({ error: "invalid_action" }, { status: 400 });
}
