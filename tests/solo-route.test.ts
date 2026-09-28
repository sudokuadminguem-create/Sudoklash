import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/solo/route";
import { MIN_SOLO_SECONDS } from "@/lib/solo-rules";
import { solveGrid } from "@/lib/sudoku-solver";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: ReturnType<typeof installTestDatabase>;

async function startGame() {
  const { body } = await callRoute(POST, { action: "start", difficulty: "Facile" });
  const solution = solveGrid(body.puzzle)!;
  const empty = body.puzzle.indexOf(0) as number;
  return { gameId: body.gameId as string, puzzle: body.puzzle as number[], solution, empty };
}

beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-09-26T10:00:00Z") });
  signIn("alice");
});
afterEach(() => vi.useRealTimers());

describe("solo games", () => {
  it("gives guests a practice grid with its solution, and saves nothing", async () => {
    signIn(null);
    const { status, body } = await callRoute(POST, { action: "start", difficulty: "Débutant" });
    expect(status).toBe(200);
    expect(body.guest).toBe(true);
    expect(solveGrid(body.puzzle)).toEqual(body.solution);
    expect(db.prepare("SELECT COUNT(*) AS n FROM solo_games").get()).toEqual({ n: 0 });
  });

  it("never sends the solution to signed-in players", async () => {
    const { body } = await callRoute(POST, { action: "start", difficulty: "Expert" });
    expect(body.guest).toBe(false);
    expect(body.solution).toBeUndefined();
    expect(body.puzzle.filter((n: number) => n === 0).length).toBeGreaterThan(40);
  });

  it("rejects unknown difficulties", async () => {
    expect((await callRoute(POST, { action: "start", difficulty: "Facile!" })).status).toBe(400);
  });

  it("checks digits and counts each mistake once", async () => {
    const { gameId, solution, empty } = await startGame();
    const right = { action: "check", gameId, index: empty, mistakeId: id(1) };
    expect((await callRoute(POST, { ...right, number: solution[empty] })).body).toEqual({
      correct: true,
      mistakes: 0,
    });
    const wrong = { ...right, number: (solution[empty] % 9) + 1, mistakeId: id(2) };
    expect((await callRoute(POST, wrong)).body).toEqual({ correct: false, mistakes: 1 });
    expect((await callRoute(POST, wrong)).body).toEqual({ correct: false, mistakes: 1 });
  });

  it("ends the game after three mistakes", async () => {
    const { gameId, solution, empty } = await startGame();
    for (let n = 1; n <= 3; n++)
      await callRoute(POST, {
        action: "check",
        gameId,
        index: empty,
        number: ((solution[empty] + n - 1) % 9) + 1,
        mistakeId: id(n),
      });
    const next = await callRoute(POST, {
      action: "check",
      gameId,
      index: empty,
      number: solution[empty],
      mistakeId: id(9),
    });
    expect(next.status).toBe(409);
  });

  it("hands out three hints at most", async () => {
    const { gameId, puzzle, solution } = await startGame();
    for (let n = 0; n < 3; n++) {
      const { body } = await callRoute(POST, { action: "hint", gameId, grid: puzzle });
      expect(body.hint.number).toBe(solution[body.hint.index]);
    }
    expect((await callRoute(POST, { action: "hint", gameId, grid: puzzle })).status).toBe(409);
  });

  it("gives the hint in the cell asked for when it still needs a digit", async () => {
    const { gameId, puzzle, solution } = await startGame();
    const empty = puzzle.map((v: number, i: number) => (v ? -1 : i)).filter((i: number) => i >= 0);
    const wanted = empty[empty.length - 1];
    const { body } = await callRoute(POST, { action: "hint", gameId, grid: puzzle, index: wanted });
    expect(body.hint).toEqual({ index: wanted, number: solution[wanted] });
    // A given cell needs nothing: the first open cell is used instead.
    const given = puzzle.findIndex((v: number) => v);
    const other = await callRoute(POST, { action: "hint", gameId, grid: puzzle, index: given });
    expect(other.body.hint.index).toBe(empty[0]);
  });

  it("records a win timed by the server, not too fast", async () => {
    const { gameId, solution } = await startGame();
    const complete = { action: "complete", gameId, grid: solution };
    vi.advanceTimersByTime((MIN_SOLO_SECONDS - 1) * 1000);
    expect((await callRoute(POST, complete)).body).toEqual({ error: "too_fast" });
    vi.advanceTimersByTime(60_000);
    expect((await callRoute(POST, complete)).body).toMatchObject({ saved: true, xpGained: 35 });
    expect((await callRoute(POST, complete)).status).toBe(409);
    const results = db
      .prepare("SELECT user_id, difficulty, elapsed_seconds FROM solo_results")
      .all();
    expect(results).toEqual([
      { user_id: "alice", difficulty: "Facile", elapsed_seconds: MIN_SOLO_SECONDS - 1 + 60 },
    ]);
  });

  it("rejects wrong grids and other players' games", async () => {
    const { gameId, puzzle } = await startGame();
    expect((await callRoute(POST, { action: "complete", gameId, grid: puzzle })).status).toBe(422);
    signIn("mallory");
    expect((await callRoute(POST, { action: "hint", gameId, grid: puzzle })).status).toBe(404);
  });

  it("keeps a single open game per player", async () => {
    const first = await startGame();
    await startGame();
    expect(db.prepare("SELECT COUNT(*) AS n FROM solo_games").get()).toEqual({ n: 1 });
    const stale = await callRoute(POST, {
      action: "hint",
      gameId: first.gameId,
      grid: first.puzzle,
    });
    expect(stale.status).toBe(404);
  });
});
