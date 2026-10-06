import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/daily/route";
import { soloDifficulties } from "@/lib/difficulties";
import { solveGrid } from "@/lib/sudoku-solver";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";
let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-10-06T10:00:00Z") });
  signIn("alice");
});
afterEach(() => vi.useRealTimers());
const url = (d: string, ranking = false) =>
  `http://test/api/daily?difficulty=${encodeURIComponent(d)}${ranking ? "&view=leaderboard" : ""}`;
it("keeps six independent attempts and preserves the original easy attempt", async () => {
  for (const difficulty of soloDifficulties) {
    expect((await callRoute(GET, undefined, url(difficulty))).body.status).toBe("not_started");
    const start = await callRoute(POST, { action: "ready", difficulty });
    expect(start.body.status).toBe("in_progress");
  }
  expect(db.prepare("SELECT COUNT(*) AS n FROM daily_attempts").get()).toEqual({ n: 6 });
  const easy = (await callRoute(GET, undefined, url("Facile"))).body;
  vi.advanceTimersByTime(120000);
  expect(
    (
      await callRoute(POST, {
        action: "complete",
        difficulty: "Facile",
        grid: solveGrid(easy.puzzle),
      })
    ).body.status,
  ).toBe("completed");
  expect((await callRoute(GET, undefined, url("Maître"))).body.status).toBe("in_progress");
  expect((await callRoute(POST, { action: "ready" })).body.status).toBe("completed");
  expect((await callRoute(GET, undefined, url("Facile", true))).body.players).toHaveLength(1);
  expect((await callRoute(GET, undefined, url("Maître", true))).body.players).toHaveLength(0);
});
it("shares grids per difficulty and day and resets attempts the next day", async () => {
  const first = (await callRoute(POST, { action: "ready", difficulty: "Expert" })).body;
  signIn("bob");
  expect((await callRoute(GET, undefined, url("Expert"))).body.puzzle).toEqual(first.puzzle);
  expect((await callRoute(GET, undefined, url("Expert"))).body.status).toBe("not_started");
  signIn("alice");
  vi.advanceTimersByTime(86400000);
  expect((await callRoute(GET, undefined, url("Expert"))).body.status).toBe("not_started");
});
it("rejects unsupported difficulties without creating an attempt", async () => {
  expect((await callRoute(POST, { action: "ready", difficulty: "invalid" })).status).toBe(400);
  expect((await callRoute(GET, undefined, url("invalid"))).status).toBe(400);
  expect(db.prepare("SELECT COUNT(*) AS n FROM daily_attempts").get()).toEqual({ n: 0 });
});
