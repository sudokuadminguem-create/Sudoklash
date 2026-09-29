import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/solo/route";
import { GET as cosmetics, POST as equip } from "@/app/api/cosmetics/route";
import { MIN_SOLO_SECONDS } from "@/lib/solo-rules";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";
import { variantBank } from "@/lib/variant-bank";
import { cagesFromText, variantIds, variantInfo, type VariantId } from "@/lib/variants";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: ReturnType<typeof installTestDatabase>;

beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-09-26T10:00:00Z") });
  signIn("alice");
});
afterEach(() => vi.useRealTimers());

const start = (variant: unknown) => callRoute(POST, { action: "start", variant });

/** The stored solution of the game just started: the browser of a signed-in player has none. */
const stored = () =>
  db.prepare("SELECT * FROM solo_games").get() as {
    id: string;
    puzzle: string;
    solution: string;
    variant: string;
    cages: string;
    difficulty: string;
  };

describe("variant games", () => {
  it("awards the divine halo only after a server-validated Killer win", async () => {
    await start("killer");
    const game = stored();
    expect((await callRoute(cosmetics)).body.unlockedFrames).not.toContain("challenge-l-026");
    vi.advanceTimersByTime(MIN_SOLO_SECONDS * 1000);
    const result = await callRoute(POST, { action: "complete", gameId: game.id, grid: game.solution.split("").map(Number) });
    expect(result.status).toBe(200);
    expect((await callRoute(cosmetics)).body.unlockedFrames).toContain("challenge-l-026");
    const equipped = await callRoute(equip, { action: "equip_frame", id: "challenge-l-026" });
    expect(equipped.status).toBe(200);
    expect(equipped.body.frameId).toBe("challenge-l-026");
    await callRoute(cosmetics);
    expect(db.prepare("SELECT COUNT(*) AS n FROM achievement_unlocks WHERE achievement_id='challenge-l-026'").get()).toEqual({ n: 1 });
  });
  it("rejects unknown variants", async () => {
    for (const bad of ["classic", "hyper", 3, null, ""])
      expect((await start(bad)).body.error).toBe("invalid_variant");
  });

  it("gives guests a practice grid with its solution and cages, and saves nothing", async () => {
    signIn(null);
    for (const variant of variantIds) {
      const { body } = await start(variant);
      const size = variantInfo[variant].size;
      expect(body).toMatchObject({ guest: true, variant });
      expect(body.puzzle).toHaveLength(size * size);
      expect(body.solution).toHaveLength(size * size);
      expect(body.cages.length > 0).toBe(variant === "killer");
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM solo_games").get()).toEqual({ n: 0 });
  });

  for (const variant of variantIds) {
    it(`never sends the solution of a signed-in ${variantInfo[variant].label} game`, async () => {
      const { body } = await start(variant);
      expect(body.guest).toBe(false);
      expect(body.solution).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain(stored().solution);
      expect(stored()).toMatchObject({ variant, difficulty: variantInfo[variant].label });
      expect(body.puzzle).toHaveLength(variantInfo[variant].size ** 2);
    });
  }

  it("sends the cages of a killer game and keeps them with the game", async () => {
    const { body } = await start("killer");
    expect(body.cages.length).toBeGreaterThan(20);
    expect(stored().cages).toBe(
      body.cages
        .map((c: { cells: number[]; sum: number }) => `${c.cells.join(",")}:${c.sum}`)
        .join(";"),
    );
    expect(cagesFromText(stored().cages)).toEqual(body.cages);
  });

  it("replaces the open game whatever its kind", async () => {
    await callRoute(POST, { action: "start", difficulty: "Facile" });
    await start("mini");
    const rows = db.prepare("SELECT variant FROM solo_games").all();
    expect(rows).toEqual([{ variant: "mini" }]);
  });

  it("checks digits up to the size of the grid only", async () => {
    const { body } = await start("mini");
    const game = stored();
    const cell = body.puzzle.indexOf(0);
    const check = (number: unknown, mistakeId = id(1), index: unknown = cell) =>
      callRoute(POST, { action: "check", gameId: game.id, index, number, mistakeId });
    expect((await check(7)).status).toBe(400); // no 7 on a 6×6 grid
    expect((await check(0)).status).toBe(400);
    expect((await check(1, id(2), 36)).status).toBe(400); // only 36 cells
    const right = Number(game.solution[cell]);
    expect((await check(right)).body).toEqual({ correct: true, mistakes: 0 });
    const wrong = (right % 6) + 1;
    expect((await check(wrong, id(3))).body).toEqual({ correct: false, mistakes: 1 });
  });

  it("gives no hints in a variant", async () => {
    const { body } = await start("diagonal");
    const hint = await callRoute(POST, { action: "hint", gameId: stored().id, grid: body.puzzle });
    expect(hint.status).toBe(409);
    expect(hint.body.error).toBe("hints_unavailable");
  });

  it("accepts the right grid after the minimum time and rejects others", async () => {
    const { body } = await start("mini");
    const game = stored();
    const solution = game.solution.split("").map(Number);
    vi.advanceTimersByTime(MIN_SOLO_SECONDS * 1000);
    const swapped = [...solution];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const complete = (grid: unknown) =>
      callRoute(POST, { action: "complete", gameId: game.id, grid });
    expect((await complete(swapped)).status).toBe(422);
    expect((await complete(solution.slice(0, 35))).status).toBe(422);
    expect((await complete(Array(81).fill(1))).status).toBe(422);
    expect(body.puzzle.every((v: number, i: number) => !v || v === solution[i])).toBe(true);
    expect((await complete(solution)).body).toMatchObject({ saved: true, xpGained: 25 });
    expect((await complete(solution)).status).toBe(409);
  });

  it("rewards each variant with its own experience and keeps its results apart", async () => {
    const expected: Record<VariantId, number> = { mini: 25, diagonal: 70, killer: 100 };
    for (const variant of variantIds) {
      await start(variant);
      const game = stored();
      vi.advanceTimersByTime(MIN_SOLO_SECONDS * 1000);
      const grid = game.solution.split("").map(Number);
      const done = await callRoute(POST, { action: "complete", gameId: game.id, grid });
      expect(done.body.xpGained).toBe(expected[variant]);
      db.prepare("DELETE FROM solo_games").run();
    }
    const labels = db.prepare("SELECT difficulty FROM solo_results ORDER BY completed_at").all();
    expect(labels).toEqual(
      variantIds.map((variant) => ({ difficulty: variantInfo[variant].label })),
    );
    // Experience adds up on the account: 25 + 70 + 100.
    expect((await callRoute(cosmetics)).body).toMatchObject({ counts: { solo: 3, soloXp: 195 } });
  });

  it("serves grids from the bank", async () => {
    for (const variant of ["diagonal", "killer"] as const) {
      await start(variant);
      const solution = stored().solution;
      const known = variantBank[variant].map((e) => e.solution);
      if (variant === "killer") expect(known).toContain(solution);
      db.prepare("DELETE FROM solo_games").run();
    }
  });
});
