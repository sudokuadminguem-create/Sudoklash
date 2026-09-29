import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/weekly/route";
import { solveGrid } from "@/lib/sudoku-solver";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-09-23T10:00:00Z") }); // a Wednesday
  signIn("alice");
});
afterEach(() => vi.useRealTimers());

describe("weekly challenge", () => {
  it("requires sign-in", async () => {
    signIn(null);
    expect((await callRoute(GET)).status).toBe(401);
    expect((await callRoute(POST, { action: "ready" })).status).toBe(401);
  });

  it("serves one attempt per week, completed with the right grid", async () => {
    const start = (await callRoute(POST, { action: "ready" })).body;
    expect(start.status).toBe("in_progress");
    const solution = solveGrid(start.puzzle)!;
    vi.setSystemTime(new Date("2026-09-23T10:05:00Z"));
    const done = await callRoute(POST, { action: "complete", grid: solution });
    expect(done.body).toMatchObject({ status: "completed", elapsedSeconds: 300 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM weekly_attempts").get()).toEqual({ n: 1 });
  });

  it("keeps the same grid for the whole week and changes it the next week", async () => {
    const first = (await callRoute(GET)).body.puzzle;
    vi.setSystemTime(new Date("2026-09-25T18:00:00Z"));
    expect((await callRoute(GET)).body.puzzle).toEqual(first);
    vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
    expect((await callRoute(GET)).body.puzzle).not.toEqual(first);
  });

  it("rejects a wrong grid and unknown actions", async () => {
    await callRoute(POST, { action: "ready" });
    expect((await callRoute(POST, { action: "complete", grid: Array(81).fill(1) })).status).toBe(
      422,
    );
    expect((await callRoute(POST, { action: "win" })).status).toBe(400);
  });
});
