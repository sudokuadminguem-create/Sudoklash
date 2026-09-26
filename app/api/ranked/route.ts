import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { solvePuzzle } from "@/lib/sudoku-solver";
import { makeSudokuVariant } from "@/app/lib/sudoku-variants";
import { rankedPosition } from "@/lib/ranked-position";
import {
  rankFor,
  rankedPointChange,
  rankedPuzzles,
  type RankedDifficulty,
} from "@/lib/ranked-rules";

export const dynamic = "force-dynamic";

type Queue = {
  user_id: string;
  queued_at: number;
  heartbeat_at: number;
  match_id: string | null;
  difficulty: RankedDifficulty;
};
type Rating = { user_id: string; points: number; wins: number; losses: number };
type Match = {
  id: string;
  player1_id: string;
  player2_id: string;
  puzzle: string;
  solution: string;
  difficulty: RankedDifficulty;
  started_at: number;
  status: string;
  winner_id: string | null;
  player1_progress: number;
  player2_progress: number;
  player1_mistakes: number;
  player2_mistakes: number;
  finished_at: number | null;
  finish_reason: string | null;
  rated_at: number | null;
  player1_points_before: number | null;
  player2_points_before: number | null;
  player1_points_change: number | null;
  player2_points_change: number | null;
};
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const queueFor = (userId: string) =>
  env.DB!.prepare("SELECT * FROM ranked_queue WHERE user_id = ?").bind(userId).first<Queue>();
const matchFor = (id: string) =>
  env.DB!.prepare("SELECT * FROM ranked_matches WHERE id = ?").bind(id).first<Match>();
const ratingFor = (userId: string) =>
  env.DB!.prepare("SELECT * FROM ranked_ratings WHERE user_id = ?").bind(userId).first<Rating>();
const totalToFill = (match: Match) => match.puzzle.split("").filter((c) => c === "0").length;
async function rankState(userId: string) {
  const rating = await ratingFor(userId),
    points = rating?.points ?? 0,
    position = await rankedPosition(env.DB!, userId, points);
  return {
    rank: rankFor(points, position),
    points,
    wins: rating?.wins ?? 0,
    losses: rating?.losses ?? 0,
    position,
  };
}

async function settle(match: Match) {
  if (match.status !== "finished" || match.rated_at || !match.winner_id) return;
  const now = Date.now();
  await env.DB!.batch([
    env
      .DB!.prepare(
        "INSERT OR IGNORE INTO ranked_ratings (user_id,points,wins,losses,updated_at) VALUES (?,0,0,0,?)",
      )
      .bind(match.player1_id, now),
    env
      .DB!.prepare(
        "INSERT OR IGNORE INTO ranked_ratings (user_id,points,wins,losses,updated_at) VALUES (?,0,0,0,?)",
      )
      .bind(match.player2_id, now),
  ]);
  const [one, two] = await Promise.all([ratingFor(match.player1_id), ratingFor(match.player2_id)]);
  if (!one || !two) throw new Error("rating_unavailable");
  const winnerFirst = match.winner_id === match.player1_id;
  const winnerFilled = winnerFirst ? match.player1_progress : match.player2_progress;
  const loserFilled = winnerFirst ? match.player2_progress : match.player1_progress;
  const amount = rankedPointChange(winnerFilled, loserFilled, totalToFill(match));
  const oneChange = winnerFirst ? amount : -Math.min(one.points, amount);
  const twoChange = winnerFirst ? -Math.min(two.points, amount) : amount;
  const token = crypto.randomUUID();
  await env.DB!.batch([
    env
      .DB!.prepare(
        "UPDATE ranked_matches SET rated_at=?,rating_token=?,player1_points_before=?,player2_points_before=?,player1_points_change=?,player2_points_change=? WHERE id=? AND status='finished' AND rated_at IS NULL",
      )
      .bind(now, token, one.points, two.points, oneChange, twoChange, match.id),
    env
      .DB!.prepare(
        "UPDATE ranked_ratings SET points=points+?,wins=wins+?,losses=losses+?,updated_at=? WHERE user_id=? AND EXISTS (SELECT 1 FROM ranked_matches WHERE id=? AND rating_token=?)",
      )
      .bind(oneChange, winnerFirst ? 1 : 0, winnerFirst ? 0 : 1, now, one.user_id, match.id, token),
    env
      .DB!.prepare(
        "UPDATE ranked_ratings SET points=points+?,wins=wins+?,losses=losses+?,updated_at=? WHERE user_id=? AND EXISTS (SELECT 1 FROM ranked_matches WHERE id=? AND rating_token=?)",
      )
      .bind(twoChange, winnerFirst ? 0 : 1, winnerFirst ? 1 : 0, now, two.user_id, match.id, token),
  ]);
}

async function state(userId: string) {
  const queue = await queueFor(userId),
    ranked = await rankState(userId);
  if (!queue) return { status: "idle", ...ranked };
  if (!queue.match_id) return { status: "waiting", queuedAt: queue.queued_at, ...ranked };
  let match = await matchFor(queue.match_id);
  if (!match) return { status: "waiting", queuedAt: queue.queued_at, ...ranked };
  if (match.status === "finished" && !match.rated_at) {
    await settle(match);
    match = (await matchFor(match.id))!;
  }
  const first = match.player1_id === userId,
    opponentId = first ? match.player2_id : match.player1_id;
  const profile = await env
    .DB!.prepare("SELECT username FROM player_profiles WHERE user_id = ?")
    .bind(opponentId)
    .first<{ username: string }>();
  const updated = match.status === "finished" ? await rankState(userId) : ranked;
  const ownFilled = first ? match.player1_progress : match.player2_progress;
  const opponentFilled = first ? match.player2_progress : match.player1_progress;
  return {
    status: match.status,
    id: match.id,
    puzzle: match.puzzle,
    difficulty: match.difficulty,
    startedAt: match.started_at,
    finishedAt: match.finished_at,
    winnerId: match.winner_id,
    finishReason: match.finish_reason,
    opponentName: profile?.username ?? "Adversaire",
    opponentProgress: opponentFilled,
    myFilled: ownFilled,
    opponentFilled,
    totalToFill: totalToFill(match),
    difference: Math.abs(ownFilled - opponentFilled),
    durationSeconds: match.finished_at
      ? Math.max(1, Math.floor((match.finished_at - match.started_at) / 1000))
      : null,
    mistakes: first ? match.player1_mistakes : match.player2_mistakes,
    pointsChange: first ? match.player1_points_change : match.player2_points_change,
    pointsBefore: first ? match.player1_points_before : match.player2_points_before,
    ...updated,
  };
}

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("leaderboard") === "1") {
      const rows = await env
        .DB!.prepare(
          "SELECT r.user_id,r.points,r.wins,r.losses,COALESCE(p.username,'Joueur') AS username FROM ranked_ratings r LEFT JOIN player_profiles p ON p.user_id=r.user_id ORDER BY r.points DESC,r.user_id ASC LIMIT 100",
        )
        .all<Rating & { username: string }>();
      return json({
        players: rows.results.map((r, i) => ({
          position: i + 1,
          username: r.username,
          points: r.points,
          wins: r.wins,
          losses: r.losses,
          rank: rankFor(r.points, i + 1),
        })),
      });
    }
    const user = await getSiteUser(request);
    if (!user) return json({ error: "authentication_required" }, 401);
    await env
      .DB!.prepare(
        "UPDATE ranked_queue SET heartbeat_at = ? WHERE user_id = ? AND match_id IS NULL",
      )
      .bind(Date.now(), user.userId)
      .run();
    return json(await state(user.userId));
  } catch {
    return json({ error: "matchmaking_unavailable" }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    index?: number;
    number?: number;
    mistakeId?: string;
    grid?: number[];
  } | null;
  if (!body) return json({ error: "invalid_request" }, 400);
  const userId = user.userId;
  try {
    if (body.action === "join") {
      const previous = await queueFor(userId);
      if (previous?.match_id) {
        const old = await matchFor(previous.match_id);
        if (old?.status === "playing") return json(await state(userId));
        if (old) await settle(old);
        await env
          .DB!.prepare("DELETE FROM ranked_queue WHERE user_id = ? AND match_id = ?")
          .bind(userId, previous.match_id)
          .run();
      }
      const now = Date.now();
      await env
        .DB!.prepare(
          "INSERT OR IGNORE INTO ranked_ratings (user_id,points,wins,losses,updated_at) VALUES (?,0,0,0,?)",
        )
        .bind(userId, now)
        .run();
      const currentRank = await rankState(userId);
      const difficulty = currentRank.rank.difficulty;
      await env
        .DB!.prepare(
          "INSERT INTO ranked_queue (user_id,queued_at,heartbeat_at,match_id,difficulty) VALUES (?,?,?,NULL,?) ON CONFLICT(user_id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,difficulty=excluded.difficulty WHERE match_id IS NULL",
        )
        .bind(userId, now, now, difficulty)
        .run();
      const current = await queueFor(userId);
      if (current?.match_id) return json(await state(userId));
      const opponent = await env
        .DB!.prepare(
          "SELECT q.user_id FROM ranked_queue q LEFT JOIN ranked_ratings r ON r.user_id=q.user_id WHERE q.match_id IS NULL AND q.user_id != ? AND q.difficulty = ? AND q.heartbeat_at > ? AND ABS(COALESCE(r.points,0)-?) <= 300 ORDER BY ABS(COALESCE(r.points,0)-?),q.queued_at LIMIT 1",
        )
        .bind(userId, difficulty, now - 15000, currentRank.points, currentRank.points)
        .first<{ user_id: string }>();
      if (opponent) {
        const id = crypto.randomUUID();
        const claimed = await env
          .DB!.prepare(
            "UPDATE ranked_queue SET match_id = ? WHERE user_id IN (?, ?) AND match_id IS NULL AND heartbeat_at > ? RETURNING user_id",
          )
          .bind(id, userId, opponent.user_id, now - 15000)
          .all<{ user_id: string }>();
        if (claimed.results.length === 2) {
          try {
            const base = rankedPuzzles[difficulty],
              solution = solvePuzzle(base);
            if (!solution) throw new Error("invalid_ranked_puzzle");
            const variant = makeSudokuVariant(base.split("").map(Number), solution);
            await env
              .DB!.prepare(
                "INSERT INTO ranked_matches (id,player1_id,player2_id,puzzle,solution,difficulty,started_at) VALUES (?,?,?,?,?,?,?)",
              )
              .bind(
                id,
                opponent.user_id,
                userId,
                variant.puzzle.join(""),
                variant.solution.join(""),
                difficulty,
                Date.now(),
              )
              .run();
          } catch (error) {
            await env
              .DB!.prepare("UPDATE ranked_queue SET match_id = NULL WHERE match_id = ?")
              .bind(id)
              .run();
            throw error;
          }
        } else
          await env
            .DB!.prepare("UPDATE ranked_queue SET match_id = NULL WHERE match_id = ?")
            .bind(id)
            .run();
      }
      return json(await state(userId));
    }
    if (body.action === "cancel") {
      await env
        .DB!.prepare("DELETE FROM ranked_queue WHERE user_id = ? AND match_id IS NULL")
        .bind(userId)
        .run();
      return json(await state(userId));
    }
    const queue = await queueFor(userId);
    const match = queue?.match_id ? await matchFor(queue.match_id) : null;
    if (!match || ![match.player1_id, match.player2_id].includes(userId))
      return json({ error: "match_not_found" }, 404);
    const first = match.player1_id === userId;
    const progress = first ? "player1_progress" : "player2_progress";
    const mistakes = first ? "player1_mistakes" : "player2_mistakes";
    const lastId = first ? "player1_last_mistake_id" : "player2_last_mistake_id";
    const opponentId = first ? match.player2_id : match.player1_id;
    if (body.action === "progress") {
      if (!validGrid(body.grid, match)) return json({ error: "invalid_grid" }, 400);
      const correct = body.grid!.reduce(
        (count, n, i) =>
          count + (match.puzzle[i] === "0" && n === Number(match.solution[i]) ? 1 : 0),
        0,
      );
      await env
        .DB!.prepare(
          `UPDATE ranked_matches SET ${progress} = MAX(${progress}, ?) WHERE id = ? AND status = 'playing'`,
        )
        .bind(correct, match.id)
        .run();
      return json(await state(userId));
    }
    if (body.action === "mistake") {
      const i = body.index,
        n = body.number;
      if (
        !Number.isInteger(i) ||
        i! < 0 ||
        i! > 80 ||
        !Number.isInteger(n) ||
        n! < 1 ||
        n! > 9 ||
        typeof body.mistakeId !== "string" ||
        !UUID_PATTERN.test(body.mistakeId) ||
        match.puzzle[i!] !== "0" ||
        match.solution[i!] === String(n) ||
        !validGrid(body.grid, match) ||
        body.grid![i!] !== n
      )
        return json({ error: "invalid_mistake" }, 400);
      const correct = body.grid!.reduce(
        (count, value, index) =>
          count + (match.puzzle[index] === "0" && value === Number(match.solution[index]) ? 1 : 0),
        0,
      );
      await env
        .DB!.prepare(
          `UPDATE ranked_matches SET ${mistakes} = ${mistakes} + 1, ${lastId} = ?, ${progress} = MAX(${progress}, ?), status = CASE WHEN ${mistakes} >= 2 THEN 'finished' ELSE status END, winner_id = CASE WHEN ${mistakes} >= 2 THEN ? ELSE winner_id END, finish_reason = CASE WHEN ${mistakes} >= 2 THEN 'three_mistakes' ELSE finish_reason END, finished_at = CASE WHEN ${mistakes} >= 2 THEN ? ELSE finished_at END WHERE id = ? AND status = 'playing' AND ${mistakes} < 3 AND (${lastId} IS NULL OR ${lastId} != ?)`,
        )
        .bind(body.mistakeId, correct, opponentId, Date.now(), match.id, body.mistakeId)
        .run();
      return json(await state(userId));
    }
    if (body.action === "complete") {
      if (
        !validGrid(body.grid, match) ||
        body.grid!.some((n, i) => n !== Number(match.solution[i]))
      )
        return json({ error: "invalid_grid" }, 422);
      await env
        .DB!.prepare(
          `UPDATE ranked_matches SET status='finished',winner_id=?,finish_reason='completed',finished_at=?,${progress}=? WHERE id=? AND status='playing' AND ${mistakes}<3`,
        )
        .bind(userId, Date.now(), totalToFill(match), match.id)
        .run();
      return json(await state(userId));
    }
    return json({ error: "invalid_action" }, 400);
  } catch {
    return json({ error: "matchmaking_unavailable" }, 503);
  }
}

function validGrid(grid: unknown, match: Match): grid is number[] {
  return (
    Array.isArray(grid) &&
    grid.length === 81 &&
    grid.every(
      (n, i) =>
        Number.isInteger(n) &&
        n >= 0 &&
        n <= 9 &&
        (match.puzzle[i] === "0" || n === Number(match.puzzle[i])),
    )
  );
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
