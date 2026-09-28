import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/daily/route";
import { solveGrid } from "@/lib/sudoku-solver";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeEach(() => {
  installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-09-26T10:00:00Z") });
  signIn("alice");
});
afterEach(() => vi.useRealTimers());

async function readyAttempt() {
  const { body } = await callRoute(POST, { action: "ready" });
  const solution = solveGrid(body.puzzle)!;
  return { puzzle: body.puzzle as number[], solution, empty: body.puzzle.indexOf(0) as number };
}

describe("daily challenge", () => {
  it("requires sign-in", async () => {
    signIn(null);
    expect((await callRoute(GET)).status).toBe(401);
  });

  it("serves a bank puzzle without its solution", async () => {
    const { body } = await callRoute(GET);
    expect(body.status).toBe("not_started");
    expect(body.puzzle).toHaveLength(81);
    expect(body.solution).toBeUndefined();
    expect(solveGrid(body.puzzle)).not.toBeNull();
  });

  it("checks each digit on the server", async () => {
    const { solution, empty } = await readyAttempt();
    const entry = { action: "check", index: empty, mistakeId: id(1) };
    const right = await callRoute(POST, { ...entry, number: solution[empty] });
    expect(right.body).toMatchObject({ correct: true, mistakes: 0, status: "in_progress" });
    const wrong = { ...entry, number: (solution[empty] % 9) + 1, mistakeId: id(2) };
    expect((await callRoute(POST, wrong)).body).toMatchObject({ correct: false, mistakes: 1 });
    expect((await callRoute(POST, wrong)).body).toMatchObject({ correct: false, mistakes: 1 });
  });

  it("fails the attempt after three mistakes", async () => {
    const { solution, empty } = await readyAttempt();
    for (let n = 1; n <= 3; n++)
      await callRoute(POST, {
        action: "check",
        index: empty,
        number: ((solution[empty] + n - 1) % 9) + 1,
        mistakeId: id(n),
      });
    expect((await callRoute(GET)).body.status).toBe("failed");
    const late = await callRoute(POST, { action: "complete", grid: solution });
    expect(late.body.status).toBe("failed");
  });

  it("rejects checks on givens and before the start", async () => {
    const early = await callRoute(POST, { action: "check", index: 0, number: 1, mistakeId: id(1) });
    expect(early.status).toBe(409);
    const { puzzle } = await readyAttempt();
    const given = puzzle.findIndex(Boolean);
    const check = { action: "check", index: given, number: puzzle[given], mistakeId: id(2) };
    expect((await callRoute(POST, check)).status).toBe(422);
  });

  it("times the attempt on the server", async () => {
    const { solution } = await readyAttempt();
    vi.advanceTimersByTime(125_000);
    const { body } = await callRoute(POST, { action: "complete", grid: solution });
    expect(body).toMatchObject({ status: "completed", elapsedSeconds: 125 });
  });
});
