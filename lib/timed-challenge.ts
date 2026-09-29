import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { challengeWindow } from "@/lib/challenge-schedule";
import { getPeriodChallenge, type ChallengeKind } from "@/lib/challenges";
import { isCellIndex, isDigit, isEntryId, MAX_MISTAKES, mistakeKey } from "@/lib/entry-validation";
import { MIN_COMPLETE_SECONDS } from "@/lib/solo-rules";
import { solvePuzzle } from "@/lib/sudoku-solver";

// Daily and weekly challenges share the same rules: one timed attempt per period
// (Paris time, see lib/challenge-schedule.ts), three mistakes end it, and the server
// checks the solution and measures the time.

type AttemptRow = {
  started_at: number;
  completed_at: number | null;
  elapsed_seconds: number | null;
  mistakes: number;
  last_mistake_id: string | null;
  puzzle: string | null;
};

type ChallengeConfig = { title: string; puzzle: string };

type TimedChallenge = {
  kind: ChallengeKind;
  table: "daily_attempts" | "weekly_attempts";
  periodColumn: "day_id" | "week_id";
};

type PostBody = {
  action?: string;
  grid?: unknown;
  index?: unknown;
  number?: unknown;
  mistakeId?: unknown;
};

export const dailyChallenge: TimedChallenge = {
  kind: "daily",
  table: "daily_attempts",
  periodColumn: "day_id",
};

export const weeklyChallenge: TimedChallenge = {
  kind: "weekly",
  table: "weekly_attempts",
  periodColumn: "week_id",
};

function payload(attempt: AttemptRow | null, nextAt: string, config: ChallengeConfig) {
  const status = attempt?.completed_at
    ? "completed"
    : (attempt?.mistakes ?? 0) >= MAX_MISTAKES
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

/** Builds the GET and POST handlers of a timed challenge route. */
export function timedChallengeRoute({ kind, table, periodColumn }: TimedChallenge) {
  async function currentAttempt(userId: string, periodId: string) {
    if (!env.DB) throw new Error("database_unavailable");
    return env.DB.prepare(
      `SELECT started_at, completed_at, elapsed_seconds, mistakes, last_mistake_id, puzzle FROM ${table} WHERE user_id = ? AND ${periodColumn} = ?`,
    )
      .bind(userId, periodId)
      .first<AttemptRow>();
  }

  async function GET(request: Request) {
    const user = await getSiteUser(request);
    if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
    if (!env.DB) return Response.json({ error: "database_unavailable" }, { status: 503 });

    const { periodId, nextAt } = challengeWindow(kind);
    const [attempt, config] = await Promise.all([
      currentAttempt(user.userId, periodId),
      getPeriodChallenge(kind, periodId),
    ]);
    return Response.json(payload(attempt, nextAt, config), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  async function POST(request: Request) {
    const user = await getSiteUser(request);
    if (!user) return Response.json({ error: "authentication_required" }, { status: 401 });
    const db = env.DB;
    if (!db) return Response.json({ error: "database_unavailable" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as PostBody | null;
    const { periodId, nextAt } = challengeWindow(kind);
    const now = Date.now();
    const config = await getPeriodChallenge(kind, periodId);
    const respond = async () =>
      Response.json(payload(await currentAttempt(user.userId, periodId), nextAt, config));

    if (body?.action === "ready") {
      await db
        .prepare(
          `INSERT OR IGNORE INTO ${table} (user_id, ${periodColumn}, started_at, puzzle, created_at) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(user.userId, periodId, now, config.puzzle, now)
        .run();
      return respond();
    }

    // The browser never has the solution: it sends each digit and learns whether it is right.
    if (body?.action === "check") {
      const attempt = await currentAttempt(user.userId, periodId);
      if (!attempt) return Response.json({ error: "not_started" }, { status: 409 });
      if (attempt.completed_at || attempt.mistakes >= MAX_MISTAKES)
        return Response.json({ correct: false, ...payload(attempt, nextAt, config) });

      const { index, number, mistakeId } = body;
      if (!isCellIndex(index) || !isDigit(number) || !isEntryId(mistakeId))
        return Response.json({ error: "invalid_entry" }, { status: 400 });
      const puzzle = attempt.puzzle ?? config.puzzle;
      const solution = solvePuzzle(puzzle);
      if (puzzle[index] !== "0" || !solution)
        return Response.json({ error: "invalid_entry" }, { status: 422 });
      if (solution[index] === number)
        return Response.json({ correct: true, ...payload(attempt, nextAt, config) });

      const key = mistakeKey(mistakeId, index, number);
      await db
        .prepare(
          `UPDATE ${table} SET mistakes = mistakes + 1, last_mistake_id = ? WHERE user_id = ? AND ${periodColumn} = ? AND completed_at IS NULL AND mistakes < 3 AND (last_mistake_id IS NULL OR last_mistake_id != ?)`,
        )
        .bind(key, user.userId, periodId, key)
        .run();
      const updated = await currentAttempt(user.userId, periodId);
      return Response.json({ correct: false, ...payload(updated, nextAt, config) });
    }

    if (body?.action === "complete") {
      const attempt = await currentAttempt(user.userId, periodId);
      if (!attempt) return Response.json({ error: "not_started" }, { status: 409 });
      if (attempt.completed_at || attempt.mistakes >= MAX_MISTAKES)
        return Response.json(payload(attempt, nextAt, config));

      const grid = Array.isArray(body.grid) ? body.grid : [];
      const solution = solvePuzzle(attempt.puzzle ?? config.puzzle);
      const valid =
        solution && grid.length === 81 && grid.every((value, index) => value === solution[index]);
      if (!valid) return Response.json({ error: "invalid_solution" }, { status: 422 });

      const elapsed = Math.floor((now - attempt.started_at) / 1000);
      if (elapsed < MIN_COMPLETE_SECONDS)
        return Response.json({ error: "too_fast" }, { status: 422 });
      await db
        .prepare(
          `UPDATE ${table} SET completed_at = ?, elapsed_seconds = ? WHERE user_id = ? AND ${periodColumn} = ? AND completed_at IS NULL AND mistakes < 3`,
        )
        .bind(now, elapsed, user.userId, periodId)
        .run();
      return respond();
    }

    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  return { GET, POST };
}
