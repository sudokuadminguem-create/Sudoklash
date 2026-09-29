import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as daily } from "@/app/api/daily/route";
import { GET as rankedGet, POST as rankedPost } from "@/app/api/ranked/route";
import { POST as solo } from "@/app/api/solo/route";
import { MIN_SOLO_SECONDS } from "@/lib/solo-rules";
import { solveGrid } from "@/lib/sudoku-solver";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

// What a player who edits requests by hand can and cannot get away with. The server keeps the
// solution, the clock and the mistake count; the browser only ever sends claims.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const other = (digit: number, offset: number) => ((digit + offset - 1) % 9) + 1;
let db: ReturnType<typeof installTestDatabase>;

beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-09-26T10:00:00Z") });
  signIn("mallory");
});
afterEach(() => vi.useRealTimers());

async function startSolo(difficulty = "Facile") {
  const { body } = await callRoute(solo, { action: "start", difficulty });
  const solution = solveGrid(body.puzzle)!;
  return { gameId: body.gameId as string, puzzle: body.puzzle as number[], solution };
}

async function as(user: string, body?: unknown) {
  signIn(user);
  return callRoute(body === undefined ? rankedGet : rankedPost, body);
}

async function startRanked() {
  await as("alice", { action: "join" });
  vi.advanceTimersByTime(1000);
  await as("bob", { action: "join" });
  const match = db.prepare("SELECT * FROM ranked_matches").get() as {
    puzzle: string;
    solution: string;
  };
  return {
    puzzle: match.puzzle.split("").map(Number),
    solution: match.solution.split("").map(Number),
  };
}

describe("brute-forcing a cell by reusing one mistake id", () => {
  // The mistake id exists so a retried request is not counted twice. It must not make a
  // different wrong digit free.
  it("counts every different wrong digit in solo games", async () => {
    const { gameId, puzzle, solution } = await startSolo();
    const cell = puzzle.indexOf(0);
    const guess = (offset: number) =>
      callRoute(solo, {
        action: "check",
        gameId,
        index: cell,
        number: other(solution[cell], offset),
        mistakeId: id(1),
      });
    expect((await guess(1)).body).toEqual({ correct: false, mistakes: 1 });
    expect((await guess(2)).body).toEqual({ correct: false, mistakes: 2 });
    expect((await guess(2)).body).toEqual({ correct: false, mistakes: 2 }); // a network retry
    expect((await guess(3)).body).toEqual({ correct: false, mistakes: 3 });
    expect((await guess(4)).status).toBe(409); // game over: no more guesses to learn from
  });

  it("counts every different wrong digit in the daily challenge", async () => {
    const { body: start } = await callRoute(daily, { action: "ready" });
    const solution = solveGrid(start.puzzle)!;
    const cell = start.puzzle.indexOf(0);
    const guess = (offset: number) =>
      callRoute(daily, {
        action: "check",
        index: cell,
        number: other(solution[cell], offset),
        mistakeId: id(1),
      });
    expect((await guess(1)).body.mistakes).toBe(1);
    expect((await guess(2)).body.mistakes).toBe(2);
    expect((await guess(2)).body.mistakes).toBe(2);
    expect((await guess(3)).body).toMatchObject({ mistakes: 3, status: "failed" });
  });

  it("counts every different wrong digit in ranked matches", async () => {
    const { puzzle, solution } = await startRanked();
    const cell = puzzle.indexOf(0);
    const guess = (offset: number) => {
      const number = other(solution[cell], offset);
      return as("alice", {
        action: "check",
        index: cell,
        number,
        mistakeId: id(1),
        grid: puzzle.map((v, i) => (i === cell ? number : v)),
      });
    };
    expect((await guess(1)).body.mistakes).toBe(1);
    expect((await guess(2)).body.mistakes).toBe(2);
    expect((await guess(2)).body.mistakes).toBe(2);
    expect((await guess(3)).body).toMatchObject({ status: "finished", winnerId: "bob" });
  });
});

describe("ranked progress cannot be used to read the solution", () => {
  const check = (cell: number, number: number, grid: number[], n: number) =>
    as("alice", { action: "check", index: cell, number, mistakeId: id(n), grid });

  it("only counts cells the server has confirmed, whatever the grid claims", async () => {
    const { puzzle, solution } = await startRanked();
    const empty = puzzle.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    // A grid where five other cells are filled with the true solution.
    const grid = puzzle.map((v, i) => (empty.slice(0, 6).includes(i) ? solution[i] : v));
    const first = await check(empty[0], solution[empty[0]], grid, 1);
    expect(first.body).toMatchObject({ correct: true, myFilled: 1 });
    // The same cell again does not raise the count.
    expect((await check(empty[0], solution[empty[0]], grid, 2)).body.myFilled).toBe(1);
    // Confirming a second cell raises it by exactly one.
    expect((await check(empty[1], solution[empty[1]], grid, 3)).body.myFilled).toBe(2);
  });

  it("gives nothing away on a wrong digit", async () => {
    const { puzzle, solution } = await startRanked();
    const empty = puzzle.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const grid = puzzle.map((v, i) => (empty.slice(1, 8).includes(i) ? solution[i] : v));
    const wrong = other(solution[empty[0]], 1);
    grid[empty[0]] = wrong;
    const { body } = await check(empty[0], wrong, grid, 1);
    expect(body).toMatchObject({ correct: false, myFilled: 0 });
  });
});

describe("finishing impossibly fast", () => {
  it("rejects an instant solo win, then accepts it after the minimum time", async () => {
    const { gameId, solution } = await startSolo();
    const complete = { action: "complete", gameId, grid: solution };
    expect((await callRoute(solo, complete)).body).toEqual({ error: "too_fast" });
    vi.advanceTimersByTime(MIN_SOLO_SECONDS * 1000);
    expect((await callRoute(solo, complete)).body.saved).toBe(true);
  });

  it("rejects an instant daily win", async () => {
    const { body: start } = await callRoute(daily, { action: "ready" });
    const grid = solveGrid(start.puzzle)!;
    const early = await callRoute(daily, { action: "complete", grid });
    expect(early.status).toBe(422);
    expect(early.body.error).toBe("too_fast");
    vi.advanceTimersByTime(MIN_SOLO_SECONDS * 1000);
    expect((await callRoute(daily, { action: "complete", grid })).body.status).toBe("completed");
  });

  it("rejects an instant ranked win and leaves the match open", async () => {
    const { solution } = await startRanked();
    const early = await as("alice", { action: "complete", grid: solution });
    expect(early.status).toBe(422);
    expect(early.body.error).toBe("too_fast");
    expect((await as("bob")).body.status).toBe("playing");
    vi.advanceTimersByTime(MIN_SOLO_SECONDS * 1000);
    expect((await as("alice", { action: "complete", grid: solution })).body).toMatchObject({
      status: "finished",
      winnerId: "alice",
    });
  });
});

describe("farming rewards in solo", () => {
  it("cannot bank a game after starting another one", async () => {
    const first = await startSolo();
    await startSolo();
    vi.advanceTimersByTime(60_000);
    const late = await callRoute(solo, {
      action: "complete",
      gameId: first.gameId,
      grid: first.solution,
    });
    expect(late.status).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS n FROM solo_results").get()).toEqual({ n: 0 });
  });

  it("ignores the reward, time and difficulty claimed by the client", async () => {
    const { gameId, solution } = await startSolo("Facile");
    vi.advanceTimersByTime(90_000);
    const { body } = await callRoute(solo, {
      action: "complete",
      gameId,
      grid: solution,
      difficulty: "Maître",
      xpGained: 9999,
      elapsedSeconds: 1,
    });
    expect(body).toMatchObject({ saved: true, xpGained: 35, elapsedSeconds: 90 });
    expect(db.prepare("SELECT difficulty, elapsed_seconds FROM solo_results").get()).toEqual({
      difficulty: "Facile",
      elapsed_seconds: 90,
    });
  });

  it("does not save a grid that only looks complete", async () => {
    const { gameId, solution } = await startSolo();
    vi.advanceTimersByTime(60_000);
    const swapped = [...solution];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    for (const grid of [swapped, solution.slice(1), solution.map(String), [...solution, 1], null])
      expect((await callRoute(solo, { action: "complete", gameId, grid })).status).toBe(422);
    expect(db.prepare("SELECT COUNT(*) AS n FROM solo_results").get()).toEqual({ n: 0 });
  });

  it("does not let a guest practice grid earn anything", async () => {
    signIn(null);
    const { body } = await callRoute(solo, { action: "start", difficulty: "Maître" });
    const done = await callRoute(solo, { action: "complete", gameId: "x", grid: body.solution });
    expect(done.status).toBe(401);
    expect(db.prepare("SELECT COUNT(*) AS n FROM solo_results").get()).toEqual({ n: 0 });
  });
});

describe("tampering with a ranked match", () => {
  it("never sends the solution, to either player or to strangers", async () => {
    const { solution } = await startRanked();
    for (const user of ["alice", "bob", "mallory"]) {
      const text = JSON.stringify((await as(user)).body);
      expect(text).not.toContain(solution.join(""));
      expect(text).not.toContain('"solution"');
    }
  });

  it("lets nobody act on a match they are not in", async () => {
    const { puzzle, solution } = await startRanked();
    const cell = puzzle.indexOf(0);
    const grid = puzzle.map((v, i) => (i === cell ? solution[cell] : v));
    const attempts = [
      { action: "check", index: cell, number: solution[cell], mistakeId: id(1), grid },
      { action: "complete", grid: solution },
      { action: "forfeit" },
    ];
    for (const attempt of attempts) expect((await as("mallory", attempt)).status).toBe(404);
    expect((await as("alice")).body.status).toBe("playing");
  });

  it("rejects grids that change the givens or fill another cell than the one checked", async () => {
    const { puzzle, solution } = await startRanked();
    const cell = puzzle.indexOf(0);
    const number = solution[cell];
    const base = { action: "check", index: cell, number, mistakeId: id(1) };
    const givenIndex = puzzle.findIndex(Boolean);
    const tampered = puzzle.map((v, i) =>
      i === cell ? number : i === givenIndex ? other(v, 1) : v,
    );
    const mismatch = puzzle.map((v, i) => (i === cell ? other(number, 1) : v));
    expect((await as("alice", { ...base, grid: tampered })).status).toBe(400);
    expect((await as("alice", { ...base, grid: mismatch })).status).toBe(400);
    expect((await as("alice", { ...base, index: givenIndex, grid: puzzle })).status).toBe(400);
    expect((await as("alice", { ...base, index: 81, grid: puzzle })).status).toBe(400);
    expect((await as("alice", { ...base, number: 10, grid: puzzle })).status).toBe(400);
  });

  it("keeps the first result once the match is over", async () => {
    const { puzzle, solution } = await startRanked();
    await as("bob", { action: "forfeit" });
    vi.advanceTimersByTime(MIN_SOLO_SECONDS * 1000);
    await as("bob", { action: "complete", grid: solution });
    const cell = puzzle.indexOf(0);
    await as("bob", {
      action: "check",
      index: cell,
      number: solution[cell],
      mistakeId: id(1),
      grid: puzzle.map((v, i) => (i === cell ? solution[cell] : v)),
    });
    const { body } = await as("alice");
    expect(body).toMatchObject({ status: "finished", winnerId: "alice", finishReason: "forfeit" });
    const ratings = () =>
      db.prepare("SELECT points, wins FROM ranked_ratings WHERE user_id = 'alice'").get();
    const before = ratings();
    await as("alice");
    await as("bob");
    expect(ratings()).toEqual(before); // rating applied once
    expect(before).toMatchObject({ wins: 1 });
  });
});
