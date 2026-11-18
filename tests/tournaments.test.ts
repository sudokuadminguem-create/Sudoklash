import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/tournaments/route";
import { GET as wallet, POST as buy } from "@/app/api/cosmetics/route";
import { tournamentPrizes } from "@/lib/tournament-rules";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-11-18T15:00:00Z") });
  signIn("host");
});
afterEach(() => vi.useRealTimers());
const send = (action: string, data: Record<string, unknown> = {}) =>
  callRoute(POST, { action, ...data });
const detail = (id: string) => callRoute(GET, undefined, `http://test/api/tournaments?id=${id}`);
const create = async () =>
  (await send("create", { difficulty: "Facile", delay: 5 })).body.id as string;

it("pays the whole pot with at least 25 coins per rewarded place", () => {
  const p = tournamentPrizes(2525, 25);
  expect(p).toHaveLength(25);
  expect(p.reduce((a, b) => a + b, 0)).toBe(2525);
  expect(p[0]).toBeGreaterThan(p[24]);
  expect(p[24]).toBeGreaterThanOrEqual(25);
});

it("debits the host and entry exactly once, then refunds a cancelled tournament", async () => {
  const id = await create();
  expect((await callRoute(wallet)).body.coins).toBe(250);
  expect((await callRoute(buy, { action: "buy_avatar", id: "neon" })).status).toBe(409);
  signIn("guest");
  for (let i = 0; i < 2; i++) expect((await send("join", { id })).status).toBe(200);
  expect((await callRoute(wallet)).body.coins).toBe(275);
  vi.advanceTimersByTime(5 * 60_000);
  expect((await detail(id)).body.tournament.phase).toBe("cancelled");
  expect((await callRoute(wallet)).body.coins).toBe(300);
  signIn("host");
  expect((await callRoute(wallet)).body.coins).toBe(300);
});

it("opens one common grid only to entrants, enforces errors and distributes winnings at closure", async () => {
  const id = await create();
  for (let i = 0; i < 4; i++) {
    signIn(`p${i}`);
    expect((await send("join", { id })).status).toBe(200);
  }
  expect((await detail(id)).body.puzzle).toBeNull();
  vi.advanceTimersByTime(5 * 60_000 + 30_000);
  signIn("outsider");
  expect((await detail(id)).body.puzzle).toBeNull();
  expect((await send("join", { id })).status).toBe(409);
  signIn("p0");
  const start = (await detail(id)).body;
  expect(start.puzzle).toHaveLength(81);
  expect(start.tournament.pot).toBe(150);
  const { solution } = db.prepare("SELECT solution FROM tournaments WHERE id=?").get(id) as {
    solution: string;
  };
  const index = start.puzzle.indexOf("0"),
    wrong = (Number(solution[index]) % 9) + 1;
  for (let i = 0; i < 3; i++)
    expect(
      (await send("check", { id, index, number: wrong, entryId: crypto.randomUUID() })).body
        .mistakes,
    ).toBe(i + 1);
  const grid = solution.split("").map(Number);
  expect((await send("complete", { id, grid })).status).toBe(409);
  signIn("p1");
  expect((await detail(id)).body.puzzle).toBe(start.puzzle);
  expect((await send("complete", { id, grid })).status).toBe(200);
  vi.advanceTimersByTime(30 * 60_000);
  expect((await detail(id)).body.ranking[0].payout).toBe(150);
  expect((await callRoute(wallet)).body.coins).toBe(425);
  expect((await callRoute(wallet)).body.coins).toBe(425);
});
