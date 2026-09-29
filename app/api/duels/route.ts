import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { isSoloDifficulty } from "@/lib/difficulties";
import {
  isCellIndex,
  isDigit,
  isEntryId,
  matchesSolution,
  mistakeKey,
  MAX_MISTAKES,
} from "@/lib/entry-validation";
import { pickPuzzle } from "@/lib/puzzle-picker";
import { forfeitingPlayer } from "@/lib/ranked-rules";
import { MIN_COMPLETE_SECONDS } from "@/lib/solo-rules";

export const dynamic = "force-dynamic";

// A duel between two friends. The challenger proposes a difficulty; if the friend accepts,
// the server picks a grid, keeps the solution and judges both players like a ranked match:
// it checks every digit, counts mistakes, times the game and settles forfeits. Nothing is
// rated. The browsers poll this route, which also tells the server who is still there.

/** A challenge nobody answers within this time is dropped. */
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
/** A finished duel stays on screen for the players who have not closed it, up to this long. */
const RESULT_TTL_MS = 30 * 60 * 1000;

type Duel = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  difficulty: string;
  status: string;
  puzzle: string;
  solution: string;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  winner_id: string | null;
  finish_reason: string | null;
  challenger_solved: string;
  opponent_solved: string;
  challenger_progress: number;
  opponent_progress: number;
  challenger_mistakes: number;
  opponent_mistakes: number;
  challenger_last_mistake: string | null;
  opponent_last_mistake: string | null;
  challenger_seen_at: number | null;
  opponent_seen_at: number | null;
  challenger_dismissed: number;
  opponent_dismissed: number;
};
type Side = "challenger" | "opponent";
type Body = {
  action?: unknown;
  friendId?: unknown;
  difficulty?: unknown;
  id?: unknown;
  index?: unknown;
  number?: unknown;
  mistakeId?: unknown;
  grid?: unknown;
};

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

const sideOf = (duel: Duel, userId: string): Side =>
  duel.challenger_id === userId ? "challenger" : "opponent";
const otherId = (duel: Duel, userId: string) =>
  duel.challenger_id === userId ? duel.opponent_id : duel.challenger_id;
const totalToFill = (duel: Duel) => duel.puzzle.split("").filter((c) => c === "0").length;

const duelById = (id: string) =>
  env.DB!.prepare("SELECT * FROM friend_duels WHERE id = ?").bind(id).first<Duel>();

/** The duel being played by this user, if any. */
const playingFor = (userId: string) =>
  env
    .DB!.prepare(
      "SELECT * FROM friend_duels WHERE status = 'playing' AND (challenger_id = ?1 OR opponent_id = ?1) LIMIT 1",
    )
    .bind(userId)
    .first<Duel>();

const nameOf = async (userId: string) =>
  (
    await env
      .DB!.prepare("SELECT username FROM player_profiles WHERE user_id = ?")
      .bind(userId)
      .first<{ username: string }>()
  )?.username ?? "Ami";

const finish = (id: string, winnerId: string, reason: string) =>
  env
    .DB!.prepare(
      "UPDATE friend_duels SET status = 'finished', winner_id = ?, finish_reason = ?, finished_at = ? WHERE id = ? AND status = 'playing'",
    )
    .bind(winnerId, reason, Date.now(), id)
    .run();

// Ends a duel whose player stopped answering, then records that `userId` is here. The check
// uses the times seen before this request, so a player coming back after a long absence
// cannot win against a friend who left later.
async function trackPresence(duel: Duel, userId: string) {
  const now = Date.now();
  const started = duel.started_at ?? now;
  const forfeiting = forfeitingPlayer(
    {
      player1: duel.challenger_seen_at ?? started,
      player2: duel.opponent_seen_at ?? started,
    },
    now,
  );
  if (forfeiting)
    await finish(
      duel.id,
      forfeiting === "player1" ? duel.opponent_id : duel.challenger_id,
      "forfeit",
    );
  const column = sideOf(duel, userId) === "challenger" ? "challenger_seen_at" : "opponent_seen_at";
  await env
    .DB!.prepare(`UPDATE friend_duels SET ${column} = ? WHERE id = ? AND status = 'playing'`)
    .bind(now, duel.id)
    .run();
}

/** Wins of each side against the other over all their finished duels. */
async function recordBetween(a: string, b: string, viewer: string) {
  const rows = await env
    .DB!.prepare(
      "SELECT winner_id, COUNT(*) AS n FROM friend_duels WHERE status = 'finished' AND winner_id IS NOT NULL AND ((challenger_id = ?1 AND opponent_id = ?2) OR (challenger_id = ?2 AND opponent_id = ?1)) GROUP BY winner_id",
    )
    .bind(a, b)
    .all<{ winner_id: string; n: number }>();
  const won = (id: string) => rows.results.find((row) => row.winner_id === id)?.n ?? 0;
  return { wins: won(viewer), losses: won(viewer === a ? b : a) };
}

async function viewOf(duel: Duel, userId: string) {
  const side = sideOf(duel, userId);
  const rival = otherId(duel, userId);
  const mine = side === "challenger";
  return {
    id: duel.id,
    status: duel.status,
    difficulty: duel.difficulty,
    puzzle: duel.puzzle,
    startedAt: duel.started_at,
    finishedAt: duel.finished_at,
    winnerId: duel.winner_id,
    finishReason: duel.finish_reason,
    opponent: { id: rival, username: await nameOf(rival) },
    myFilled: mine ? duel.challenger_progress : duel.opponent_progress,
    opponentFilled: mine ? duel.opponent_progress : duel.challenger_progress,
    totalToFill: totalToFill(duel),
    mistakes: mine ? duel.challenger_mistakes : duel.opponent_mistakes,
    durationSeconds: duel.finished_at
      ? Math.max(1, Math.floor((duel.finished_at - (duel.started_at ?? duel.finished_at)) / 1000))
      : null,
    record: await recordBetween(userId, rival, userId),
  };
}

async function state(userId: string) {
  const db = env.DB!;
  const now = Date.now();
  await db
    .prepare(
      "UPDATE friend_duels SET status = 'expired' WHERE status = 'pending' AND created_at < ?",
    )
    .bind(now - CHALLENGE_TTL_MS)
    .run();

  let current = await playingFor(userId);
  if (current) {
    await trackPresence(current, userId);
    current = await duelById(current.id);
  }
  current ??= await db
    .prepare(
      "SELECT * FROM friend_duels WHERE status = 'finished' AND finished_at > ?2 AND ((challenger_id = ?1 AND challenger_dismissed = 0) OR (opponent_id = ?1 AND opponent_dismissed = 0)) ORDER BY finished_at DESC LIMIT 1",
    )
    .bind(userId, now - RESULT_TTL_MS)
    .first<Duel>();

  const incoming = await db
    .prepare(
      "SELECT d.id, d.challenger_id, d.difficulty, d.created_at, COALESCE(p.username, 'Ami') AS username FROM friend_duels d LEFT JOIN player_profiles p ON p.user_id = d.challenger_id WHERE d.status = 'pending' AND d.opponent_id = ? ORDER BY d.created_at",
    )
    .bind(userId)
    .all<{
      id: string;
      challenger_id: string;
      difficulty: string;
      created_at: number;
      username: string;
    }>();
  const outgoing = await db
    .prepare(
      "SELECT d.id, d.opponent_id, d.difficulty, d.created_at, COALESCE(p.username, 'Ami') AS username FROM friend_duels d LEFT JOIN player_profiles p ON p.user_id = d.opponent_id WHERE d.status = 'pending' AND d.challenger_id = ? LIMIT 1",
    )
    .bind(userId)
    .first<{
      id: string;
      opponent_id: string;
      difficulty: string;
      created_at: number;
      username: string;
    }>();

  return {
    incoming: incoming.results.map((row) => ({
      id: row.id,
      from: { id: row.challenger_id, username: row.username },
      difficulty: row.difficulty,
      createdAt: row.created_at,
    })),
    outgoing: outgoing
      ? {
          id: outgoing.id,
          to: { id: outgoing.opponent_id, username: outgoing.username },
          difficulty: outgoing.difficulty,
          createdAt: outgoing.created_at,
        }
      : null,
    duel: current ? await viewOf(current, userId) : null,
  };
}

/** Whether either player already has a duel going on or waiting for an answer. */
async function busy(a: string, b: string) {
  const row = await env
    .DB!.prepare(
      "SELECT COUNT(*) AS n FROM friend_duels WHERE status IN ('pending', 'playing') AND (challenger_id IN (?1, ?2) OR opponent_id IN (?1, ?2))",
    )
    .bind(a, b)
    .first<{ n: number }>();
  return (row?.n ?? 0) > 0;
}

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!env.DB) return json({ error: "duels_unavailable" }, 503);
  try {
    return json(await state(user.userId));
  } catch {
    return json({ error: "duels_unavailable" }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  const db = env.DB;
  if (!db) return json({ error: "duels_unavailable" }, 503);
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return json({ error: "invalid_request" }, 400);
  const me = user.userId;

  try {
    if (body.action === "challenge") {
      if (typeof body.friendId !== "string" || body.friendId === me)
        return json({ error: "invalid_friend" }, 400);
      if (!isSoloDifficulty(body.difficulty)) return json({ error: "invalid_difficulty" }, 400);
      const friendship = await db
        .prepare("SELECT 1 AS ok FROM friendships WHERE pair_key = ? AND status = 'accepted'")
        .bind([me, body.friendId].sort().join(":"))
        .first();
      if (!friendship) return json({ error: "not_friends" }, 403);
      await db
        .prepare(
          "UPDATE friend_duels SET status = 'expired' WHERE status = 'pending' AND created_at < ?",
        )
        .bind(Date.now() - CHALLENGE_TTL_MS)
        .run();
      if (await busy(me, body.friendId)) return json({ error: "busy" }, 409);
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO friend_duels (id, challenger_id, opponent_id, difficulty, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id, me, body.friendId, body.difficulty, Date.now())
        .run();
      return json({ ok: true, id });
    }

    if (
      typeof body.id === "string" &&
      ["accept", "decline", "cancel", "dismiss"].includes(String(body.action))
    ) {
      const duel = await duelById(body.id);
      if (!duel || (duel.challenger_id !== me && duel.opponent_id !== me))
        return json({ error: "duel_not_found" }, 404);

      if (body.action === "dismiss") {
        if (duel.status !== "finished") return json({ error: "not_finished" }, 409);
        const column =
          sideOf(duel, me) === "challenger" ? "challenger_dismissed" : "opponent_dismissed";
        await db.prepare(`UPDATE friend_duels SET ${column} = 1 WHERE id = ?`).bind(duel.id).run();
        return json({ ok: true });
      }

      if (duel.status !== "pending" || duel.created_at < Date.now() - CHALLENGE_TTL_MS)
        return json({ error: "challenge_closed" }, 409);

      if (body.action === "cancel") {
        if (duel.challenger_id !== me) return json({ error: "duel_not_found" }, 404);
        await db
          .prepare(
            "UPDATE friend_duels SET status = 'cancelled' WHERE id = ? AND status = 'pending'",
          )
          .bind(duel.id)
          .run();
        return json({ ok: true });
      }

      // Accepting or declining is up to the friend who was challenged.
      if (duel.opponent_id !== me) return json({ error: "duel_not_found" }, 404);
      if (body.action === "decline") {
        await db
          .prepare(
            "UPDATE friend_duels SET status = 'declined' WHERE id = ? AND status = 'pending'",
          )
          .bind(duel.id)
          .run();
        return json({ ok: true });
      }
      // One game at a time: a player already in a duel cannot start another.
      const other = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM friend_duels WHERE status = 'playing' AND id != ?3 AND (challenger_id IN (?1, ?2) OR opponent_id IN (?1, ?2))",
        )
        .bind(duel.challenger_id, duel.opponent_id, duel.id)
        .first<{ n: number }>();
      if ((other?.n ?? 0) > 0) return json({ error: "busy" }, 409);
      const { puzzle, solution } = pickPuzzle(duel.difficulty as Parameters<typeof pickPuzzle>[0]);
      const now = Date.now();
      const started = await db
        .prepare(
          "UPDATE friend_duels SET status = 'playing', puzzle = ?, solution = ?, started_at = ?, challenger_seen_at = ?, opponent_seen_at = ? WHERE id = ? AND status = 'pending'",
        )
        .bind(puzzle, solution, now, now, now, duel.id)
        .run();
      if (!started.meta.changes) return json({ error: "challenge_closed" }, 409);
      return json({ ok: true });
    }

    // Everything below is a move in the duel this player is in.
    const duel = await playingFor(me);
    if (!duel) return json({ error: "duel_not_found" }, 404);
    const side = sideOf(duel, me);
    const rival = otherId(duel, me);
    const solvedColumn = `${side}_solved`;
    const progressColumn = `${side}_progress`;
    const mistakesColumn = `${side}_mistakes`;
    const lastMistakeColumn = `${side}_last_mistake`;
    const current = duel as unknown as Record<string, string | number | null>;

    // The browser never has the solution: it sends each digit and learns whether it is right.
    if (body.action === "check") {
      const { index, number, mistakeId } = body;
      if (!isCellIndex(index) || !isDigit(number) || !isEntryId(mistakeId))
        return json({ error: "invalid_entry" }, 400);
      if (duel.puzzle[index] !== "0") return json({ error: "invalid_entry" }, 422);
      if (duel.solution[index] === String(number)) {
        // Progress counts only cells the server confirmed one by one.
        for (let attempt = 0; attempt < 3; attempt++) {
          const latest = (await duelById(duel.id)) as unknown as Record<
            string,
            string | number | null
          > | null;
          if (!latest || latest.status !== "playing") break;
          const known = String(latest[solvedColumn]).padEnd(81, "0");
          if (known[index] === "1") break;
          const solved = `${known.slice(0, index)}1${known.slice(index + 1)}`;
          const written = await db
            .prepare(
              `UPDATE friend_duels SET ${solvedColumn} = ?, ${progressColumn} = ? WHERE id = ? AND status = 'playing' AND ${solvedColumn} = ?`,
            )
            .bind(solved, solved.split("1").length - 1, duel.id, latest[solvedColumn])
            .run();
          if (written.meta.changes) break;
        }
        return json({ correct: true, mistakes: Number(current[mistakesColumn]) });
      }
      const key = mistakeKey(mistakeId, index, number);
      await db
        .prepare(
          `UPDATE friend_duels SET ${mistakesColumn} = ${mistakesColumn} + 1, ${lastMistakeColumn} = ?1,
             status = CASE WHEN ${mistakesColumn} >= ${MAX_MISTAKES - 1} THEN 'finished' ELSE status END,
             winner_id = CASE WHEN ${mistakesColumn} >= ${MAX_MISTAKES - 1} THEN ?2 ELSE winner_id END,
             finish_reason = CASE WHEN ${mistakesColumn} >= ${MAX_MISTAKES - 1} THEN 'three_mistakes' ELSE finish_reason END,
             finished_at = CASE WHEN ${mistakesColumn} >= ${MAX_MISTAKES - 1} THEN ?3 ELSE finished_at END
           WHERE id = ?4 AND status = 'playing' AND ${mistakesColumn} < ${MAX_MISTAKES}
             AND (${lastMistakeColumn} IS NULL OR ${lastMistakeColumn} != ?1)`,
        )
        .bind(key, rival, Date.now(), duel.id)
        .run();
      const latest = (await duelById(duel.id)) as unknown as Record<string, string | number | null>;
      return json({ correct: false, mistakes: Number(latest[mistakesColumn]) });
    }

    if (body.action === "complete") {
      if (!matchesSolution(duel.solution, body.grid)) return json({ error: "invalid_grid" }, 422);
      if (Date.now() - (duel.started_at ?? 0) < MIN_COMPLETE_SECONDS * 1000)
        return json({ error: "too_fast" }, 422);
      await db
        .prepare(
          `UPDATE friend_duels SET status = 'finished', winner_id = ?, finish_reason = 'completed', finished_at = ?, ${progressColumn} = ? WHERE id = ? AND status = 'playing' AND ${mistakesColumn} < ${MAX_MISTAKES}`,
        )
        .bind(me, Date.now(), totalToFill(duel), duel.id)
        .run();
      return json(await state(me));
    }

    if (body.action === "forfeit") {
      await finish(duel.id, rival, "forfeit");
      return json(await state(me));
    }
    return json({ error: "invalid_action" }, 400);
  } catch {
    return json({ error: "duels_unavailable" }, 503);
  }
}
