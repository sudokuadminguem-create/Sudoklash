import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { soloXpFor } from "@/lib/cosmetics";
import { isSoloDifficulty } from "@/lib/difficulties";
import {
  isCellIndex,
  isDigit,
  isEntryId,
  isGridOf,
  matchesSolution,
  mistakeKey,
  MAX_MISTAKES,
} from "@/lib/entry-validation";
import { pickPuzzle } from "@/lib/puzzle-picker";
import { pickVariantGame } from "@/lib/variant-picker";
import { cagesToText, isVariantId, sizeOfCells, variantInfo } from "@/lib/variants";
import { MAX_SOLO_HINTS, MIN_SOLO_SECONDS } from "@/lib/solo-rules";

export const dynamic = "force-dynamic";

type Game = {
  id: string;
  puzzle: string;
  solution: string;
  difficulty: string;
  started_at: number;
  mistakes: number;
  hints_used: number;
  completed_at: number | null;
  variant: string;
  cages: string;
};
type Body = {
  action?: unknown;
  difficulty?: unknown;
  gameId?: unknown;
  index?: unknown;
  number?: unknown;
  mistakeId?: unknown;
  grid?: unknown;
  variant?: unknown;
  /** Asks for a guest grid even when signed in: nothing is saved, nothing is abandoned. */
  practice?: unknown;
};

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const digits = (value: string) => value.split("").map(Number);

const gameFor = (userId: string, gameId: unknown) =>
  typeof gameId === "string"
    ? env
        .DB!.prepare("SELECT * FROM solo_games WHERE id = ? AND user_id = ?")
        .bind(gameId, userId)
        .first<Game>()
    : null;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return json({ error: "invalid_request" }, 400);
  // A practice start never touches the player's open game: it is how the app stocks spare grids.
  const user =
    body.action === "start" && body.practice === true ? null : await getSiteUser(request);

  if (body.action === "start") {
    if (body.variant !== undefined) {
      if (!isVariantId(body.variant)) return json({ error: "invalid_variant" }, 400);
      const variant = body.variant;
      const { puzzle, solution, cages } = pickVariantGame(variant);
      if (!user) return json({ guest: true, variant, puzzle, solution, cages });
      const id = crypto.randomUUID();
      await env.DB!.batch([
        env
          .DB!.prepare("DELETE FROM solo_games WHERE user_id = ? AND completed_at IS NULL")
          .bind(user.userId),
        env
          .DB!.prepare(
            "INSERT INTO solo_games (id, user_id, difficulty, puzzle, solution, started_at, variant, cages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            id,
            user.userId,
            variantInfo[variant].label,
            puzzle.join(""),
            solution.join(""),
            Date.now(),
            variant,
            cagesToText(cages),
          ),
      ]);
      return json({ guest: false, gameId: id, variant, puzzle, cages });
    }
    if (!isSoloDifficulty(body.difficulty)) return json({ error: "invalid_difficulty" }, 400);
    const { puzzle, solution } = pickPuzzle(body.difficulty);
    // Guests practise without an account: nothing is saved, so they may check locally.
    if (!user) return json({ guest: true, puzzle: digits(puzzle), solution: digits(solution) });
    const id = crypto.randomUUID();
    // One open game per player: starting a new grid abandons the previous one.
    await env.DB!.batch([
      env
        .DB!.prepare("DELETE FROM solo_games WHERE user_id = ? AND completed_at IS NULL")
        .bind(user.userId),
      env
        .DB!.prepare(
          "INSERT INTO solo_games (id, user_id, difficulty, puzzle, solution, started_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(id, user.userId, body.difficulty, puzzle, solution, Date.now()),
    ]);
    return json({ guest: false, gameId: id, puzzle: digits(puzzle) });
  }

  if (!user) return json({ error: "authentication_required" }, 401);
  const game = await gameFor(user.userId, body.gameId);
  if (!game) return json({ error: "game_not_found" }, 404);
  if (game.completed_at || game.mistakes >= MAX_MISTAKES) return json({ error: "game_over" }, 409);

  if (body.action === "check") {
    const { index, number, mistakeId } = body;
    const size = sizeOfCells(game.puzzle.length) ?? 9;
    if (!isCellIndex(index, game.puzzle.length) || !isDigit(number, size) || !isEntryId(mistakeId))
      return json({ error: "invalid_entry" }, 400);
    if (game.puzzle[index] !== "0") return json({ error: "invalid_entry" }, 422);
    if (game.solution[index] === String(number))
      return json({ correct: true, mistakes: game.mistakes });
    const key = mistakeKey(mistakeId, index, number);
    await env
      .DB!.prepare(
        "UPDATE solo_games SET mistakes = mistakes + 1, last_mistake_id = ? WHERE id = ? AND completed_at IS NULL AND mistakes < 3 AND (last_mistake_id IS NULL OR last_mistake_id != ?)",
      )
      .bind(key, game.id, key)
      .run();
    const updated = await gameFor(user.userId, game.id);
    return json({ correct: false, mistakes: updated?.mistakes ?? game.mistakes + 1 });
  }

  if (body.action === "hint") {
    // Hints teach classic techniques; the variants have none to teach yet.
    if (game.variant !== "classic") return json({ error: "hints_unavailable" }, 409);
    if (!isGridOf(game.puzzle, body.grid)) return json({ error: "invalid_grid" }, 400);
    const grid = body.grid;
    if (game.hints_used >= MAX_SOLO_HINTS) return json({ error: "no_hints_left" }, 409);
    const needs = (i: number) => grid[i] !== Number(game.solution[i]);
    // The player may ask about a given cell: the one the logical hint points to.
    const index =
      isCellIndex(body.index) && needs(body.index)
        ? body.index
        : grid.findIndex((_, i) => needs(i));
    if (index < 0) return json({ hint: null });
    const result = await env
      .DB!.prepare(
        "UPDATE solo_games SET hints_used = hints_used + 1 WHERE id = ? AND hints_used < ?",
      )
      .bind(game.id, MAX_SOLO_HINTS)
      .run();
    if (!result.meta.changes) return json({ error: "no_hints_left" }, 409);
    return json({ hint: { index, number: Number(game.solution[index]) } });
  }

  if (body.action === "complete") {
    if (!matchesSolution(game.solution, body.grid)) return json({ error: "invalid_grid" }, 422);
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - game.started_at) / 1000);
    if (elapsedSeconds < MIN_SOLO_SECONDS) return json({ error: "too_fast" }, 422);
    const finished = await env
      .DB!.prepare(
        "UPDATE solo_games SET completed_at = ? WHERE id = ? AND completed_at IS NULL AND mistakes < 3",
      )
      .bind(now, game.id)
      .run();
    if (!finished.meta.changes) return json({ error: "game_over" }, 409);
    await env
      .DB!.prepare(
        "INSERT INTO solo_results (id, user_id, difficulty, elapsed_seconds, completed_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(game.id, user.userId, game.difficulty, elapsedSeconds, now)
      .run();
    return json({ saved: true, xpGained: soloXpFor(game.difficulty), elapsedSeconds });
  }

  return json({ error: "invalid_action" }, 400);
}
