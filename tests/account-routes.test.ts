import { beforeEach, describe, expect, it } from "vitest";
import { GET as account } from "@/app/api/account/route";
import { GET as achievements } from "@/app/api/achievements/route";
import { GET as profileGet, POST as profilePost } from "@/app/api/profile/route";
import { env } from "./support/workers";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;

function withoutDatabase<T>(run: () => Promise<T>) {
  const binding = env.DB;
  (env as { DB?: D1Database }).DB = undefined;
  return run().finally(() => {
    (env as { DB?: D1Database }).DB = binding;
  });
}

beforeEach(() => {
  db = installTestDatabase();
  signIn("alice");
});

describe("account statistics", () => {
  it("requires sign-in", async () => {
    signIn(null);
    expect((await callRoute(account)).status).toBe(401);
  });

  it("reports an unavailable database", async () => {
    expect((await withoutDatabase(() => callRoute(account))).status).toBe(503);
  });

  it("returns empty statistics for a new player", async () => {
    const { status, body } = await callRoute(account);
    expect(status).toBe(200);
    expect(body.profile).toBeNull();
    expect(body.solo).toEqual({ games: 0, best: null, total: null });
    expect(body.daily).toBe(0);
    expect(body.weekly).toBe(0);
    expect(body.recent).toEqual([]);
    expect(body.ranked).toMatchObject({ points: 0, wins: 0, losses: 0 });
  });

  it("summarises finished games, best times and challenges", async () => {
    const insert = db.prepare(
      "INSERT INTO solo_results (id, user_id, difficulty, elapsed_seconds, completed_at) VALUES (?, ?, ?, ?, ?)",
    );
    insert.run("g1", "alice", "Facile", 300, 1);
    insert.run("g2", "alice", "Facile", 200, 2);
    insert.run("g3", "alice", "Expert", 900, 3);
    insert.run("g4", "bob", "Facile", 10, 4);
    db.prepare(
      "INSERT INTO daily_attempts (user_id, day_id, started_at, completed_at, puzzle, created_at) VALUES ('alice', '2026-09-25', 1, 2, '', 1)",
    ).run();
    db.prepare(
      "INSERT INTO daily_attempts (user_id, day_id, started_at, puzzle, created_at) VALUES ('alice', '2026-09-26', 1, '', 1)",
    ).run();
    db.prepare(
      "INSERT INTO ranked_ratings (user_id, points, wins, losses, updated_at) VALUES ('alice', 40, 3, 1, 1)",
    ).run();

    const { body } = await callRoute(account);
    expect(body.solo).toEqual({ games: 3, best: 200, total: 1400 });
    expect(body.daily).toBe(1); // the unfinished attempt does not count
    expect(body.recent.map((r: { difficulty: string }) => r.difficulty)).toEqual([
      "Expert",
      "Facile",
      "Facile",
    ]);
    expect(body.bestByDifficulty).toEqual(
      expect.arrayContaining([
        { difficulty: "Facile", best: 200 },
        { difficulty: "Expert", best: 900 },
      ]),
    );
    expect(body.ranked).toMatchObject({ points: 40, wins: 3, losses: 1 });
  });
});

describe("profile", () => {
  const create = (username: unknown) => callRoute(profilePost, { username });

  it("requires sign-in", async () => {
    signIn(null);
    expect((await callRoute(profileGet)).status).toBe(401);
    expect((await create("alice")).status).toBe(401);
  });

  it("has no profile until a username is chosen", async () => {
    expect((await callRoute(profileGet)).body.profile).toBeNull();
  });

  it("creates a profile with a valid username", async () => {
    const { status, body } = await create("Alice_42");
    expect(status).toBe(200);
    expect(body.profile).toMatchObject({ id: "alice", username: "Alice_42" });
    expect((await callRoute(profileGet)).body.profile.username).toBe("Alice_42");
  });

  it("rejects usernames that are too short, too long or use forbidden characters", async () => {
    for (const bad of ["ab", "a".repeat(21), "with space", "émile", "drop;table", "", 42, null])
      expect((await create(bad)).body.error).toBe("invalid_username");
    expect((await callRoute(profilePost, "not an object")).status).toBe(400);
  });

  it("does not let a second player take a name in a different case", async () => {
    await create("Champion");
    signIn("bob");
    const { status, body } = await create("champion");
    expect(status).toBe(409);
    expect(body.error).toBe("username_unavailable");
    expect(db.prepare("SELECT COUNT(*) AS n FROM player_profiles").get()).toEqual({ n: 1 });
  });

  it("keeps the first username when a player submits another one", async () => {
    await create("First_Name");
    const { body } = await create("Other_Name");
    expect(body.profile.username).toBe("First_Name");
  });
});

describe("achievements", () => {
  it("requires sign-in and a database", async () => {
    signIn(null);
    expect((await callRoute(achievements)).status).toBe(401);
    signIn("alice");
    expect((await withoutDatabase(() => callRoute(achievements))).status).toBe(503);
  });

  it("lists the public catalogue and never the majestic frames", async () => {
    const { status, body } = await callRoute(achievements);
    expect(status).toBe(200);
    expect(body.achievements.length).toBeGreaterThan(0);
    expect(body.achievements.some((a: { rarity: string }) => a.rarity === "majestic")).toBe(false);
    expect(body.achievements.every((a: { unlocked: boolean }) => a.unlocked === false)).toBe(true);
    expect(body.newlyUnlocked).toEqual([]);
  });

  it("unlocks an achievement once and stores it", async () => {
    const insert = db.prepare(
      "INSERT INTO solo_results (id, user_id, difficulty, elapsed_seconds, completed_at) VALUES (?, 'alice', 'Facile', 300, ?)",
    );
    for (let n = 0; n < 50; n++) insert.run(`g${n}`, n + 1);
    const first = await callRoute(achievements);
    const unlocked = first.body.achievements.filter((a: { unlocked: boolean }) => a.unlocked);
    expect(unlocked.length).toBeGreaterThan(0);
    const stored = db.prepare("SELECT COUNT(*) AS n FROM achievement_unlocks").get() as {
      n: number;
    };
    // Hidden frames are stored too, so the stored count can exceed the visible one.
    expect(stored.n).toBeGreaterThanOrEqual(unlocked.length);
    await callRoute(achievements);
    expect(db.prepare("SELECT COUNT(*) AS n FROM achievement_unlocks").get()).toEqual(stored);
  });
});
