import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/duels/route";
import { FORFEIT_AFTER_MS } from "@/lib/ranked-rules";
import { MIN_COMPLETE_SECONDS } from "@/lib/solo-rules";
import { env } from "./support/workers";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: ReturnType<typeof installTestDatabase>;

async function as(user: string, body?: unknown) {
  signIn(user);
  return callRoute(body === undefined ? GET : POST, body);
}
const state = (user: string) => as(user).then((r) => r.body);

beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-09-26T10:00:00Z") });
  const profile = db.prepare(
    "INSERT INTO player_profiles (user_id, username, username_key, created_at) VALUES (?, ?, ?, 1)",
  );
  for (const name of ["alice", "bob", "carol"])
    profile.run(name, name[0].toUpperCase() + name.slice(1), name);
  const friends = db.prepare(
    "INSERT INTO friendships (id, pair_key, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, ?, ?, 1)",
  );
  friends.run("f1", "alice:bob", "alice", "bob", "accepted");
  friends.run("f2", "bob:carol", "bob", "carol", "accepted");
  friends.run("f3", "alice:carol", "alice", "carol", "pending");
});
afterEach(() => vi.useRealTimers());

const challenge = (from: string, friendId: string, difficulty = "Facile") =>
  as(from, { action: "challenge", friendId, difficulty });
const answer = (user: string, action: string, duelId: string) => as(user, { action, id: duelId });

/** Alice challenges Bob, who accepts. Returns the duel id, grid and solution. */
async function startDuel() {
  const { body } = await challenge("alice", "bob");
  await answer("bob", "accept", body.id);
  const row = db.prepare("SELECT * FROM friend_duels WHERE id = ?").get(body.id) as {
    puzzle: string;
    solution: string;
  };
  return {
    id: body.id as string,
    puzzle: row.puzzle.split("").map(Number),
    solution: row.solution.split("").map(Number),
  };
}
const move = (user: string, index: number, number: number, n: number) =>
  as(user, { action: "check", index, number, mistakeId: id(n) });

describe("access", () => {
  it("requires sign-in", async () => {
    signIn(null);
    expect((await callRoute(GET)).status).toBe(401);
    expect((await callRoute(POST, { action: "forfeit" })).status).toBe(401);
  });

  it("reports an unavailable database", async () => {
    const binding = env.DB;
    (env as { DB?: D1Database }).DB = undefined;
    try {
      expect((await as("alice")).status).toBe(503);
      expect((await as("alice", { action: "forfeit" })).status).toBe(503);
    } finally {
      (env as { DB?: D1Database }).DB = binding;
    }
  });

  it("starts empty and rejects bad requests", async () => {
    expect(await state("alice")).toEqual({ incoming: [], outgoing: null, duel: null });
    expect((await as("alice", "nope")).status).toBe(400);
    expect((await as("alice", { action: "dance" })).status).toBe(404); // no duel to act on
  });
});

describe("challenges", () => {
  it("only lets a player challenge an accepted friend, with a real difficulty", async () => {
    expect((await challenge("alice", "alice")).body.error).toBe("invalid_friend");
    expect(
      (await as("alice", { action: "challenge", friendId: 7, difficulty: "Facile" })).status,
    ).toBe(400);
    expect((await challenge("alice", "bob", "Impossible")).body.error).toBe("invalid_difficulty");
    expect((await challenge("alice", "carol")).status).toBe(403); // request still pending
    expect((await challenge("alice", "stranger")).body.error).toBe("not_friends");
    expect(db.prepare("SELECT COUNT(*) AS n FROM friend_duels").get()).toEqual({ n: 0 });
  });

  it("shows the challenge to both players", async () => {
    const { body } = await challenge("alice", "bob", "Difficile");
    expect(body.ok).toBe(true);
    const bob = await state("bob");
    expect(bob.incoming).toEqual([
      expect.objectContaining({
        id: body.id,
        difficulty: "Difficile",
        from: { id: "alice", username: "Alice" },
      }),
    ]);
    const alice = await state("alice");
    expect(alice.outgoing).toMatchObject({ id: body.id, to: { id: "bob", username: "Bob" } });
    expect(alice.incoming).toEqual([]);
  });

  it("allows one duel at a time for each player", async () => {
    await challenge("alice", "bob");
    expect((await challenge("alice", "bob")).body.error).toBe("busy");
    expect((await challenge("bob", "alice")).body.error).toBe("busy");
    expect((await challenge("bob", "carol")).body.error).toBe("busy"); // Bob has a challenge waiting
  });

  it("lets the challenger cancel and the friend decline, after which both are free", async () => {
    const first = (await challenge("alice", "bob")).body.id;
    expect((await answer("bob", "cancel", first)).status).toBe(404); // not Bob's to cancel
    expect((await answer("alice", "cancel", first)).body).toEqual({ ok: true });
    expect((await state("bob")).incoming).toEqual([]);
    const second = (await challenge("alice", "bob")).body.id;
    expect((await answer("alice", "decline", second)).status).toBe(404); // not Alice's to decline
    expect((await answer("bob", "decline", second)).body).toEqual({ ok: true });
    expect((await answer("bob", "accept", second)).body.error).toBe("challenge_closed");
    expect((await challenge("bob", "alice")).body.ok).toBe(true);
  });

  it("lets nobody but the friend accept", async () => {
    const duelId = (await challenge("alice", "bob")).body.id;
    expect((await answer("alice", "accept", duelId)).status).toBe(404);
    expect((await answer("carol", "accept", duelId)).status).toBe(404);
    expect((await answer("bob", "accept", "no-such-duel")).status).toBe(404);
    expect(db.prepare("SELECT status FROM friend_duels").get()).toEqual({ status: "pending" });
  });

  it("drops a challenge nobody answers within ten minutes", async () => {
    const duelId = (await challenge("alice", "bob")).body.id;
    vi.advanceTimersByTime(10 * 60_000 + 1000);
    expect((await answer("bob", "accept", duelId)).body.error).toBe("challenge_closed");
    expect((await state("bob")).incoming).toEqual([]);
    expect((await state("alice")).outgoing).toBeNull();
    expect((await challenge("alice", "bob")).body.ok).toBe(true); // free again
  });
});

describe("playing", () => {
  it("starts on accept, with a grid for both and the solution for nobody", async () => {
    const duel = await startDuel();
    for (const user of ["alice", "bob"]) {
      const { duel: view } = await state(user);
      expect(view).toMatchObject({ id: duel.id, status: "playing", difficulty: "Facile" });
      expect(view.puzzle).toBe(duel.puzzle.join(""));
      expect(JSON.stringify(view)).not.toContain(duel.solution.join(""));
      expect(view.totalToFill).toBe(duel.puzzle.filter((v) => !v).length);
    }
    expect((await state("alice")).duel.opponent).toEqual({ id: "bob", username: "Bob" });
    expect((await state("carol")).duel).toBeNull();
    expect((await challenge("alice", "bob")).body.error).toBe("busy");
  });

  it("checks digits and shows each player the other's progress", async () => {
    const { puzzle, solution } = await startDuel();
    const [a, b] = puzzle.flatMap((v, i) => (v ? [] : [i]));
    expect((await move("alice", a, solution[a], 1)).body).toEqual({ correct: true, mistakes: 0 });
    expect((await move("alice", b, solution[b], 2)).body.correct).toBe(true);
    expect((await move("alice", b, solution[b], 3)).body.correct).toBe(true); // again: no double count
    const bob = (await state("bob")).duel;
    expect(bob).toMatchObject({ myFilled: 0, opponentFilled: 2 });
    expect((await state("alice")).duel).toMatchObject({ myFilled: 2, opponentFilled: 0 });
  });

  it("rejects invalid entries and checks on givens", async () => {
    const { puzzle, solution } = await startDuel();
    const empty = puzzle.indexOf(0);
    const given = puzzle.findIndex(Boolean);
    expect((await move("alice", 81, 1, 1)).status).toBe(400);
    expect((await move("alice", empty, 10, 2)).status).toBe(400);
    expect(
      (
        await as("alice", {
          action: "check",
          index: empty,
          number: solution[empty],
          mistakeId: "x",
        })
      ).status,
    ).toBe(400);
    expect((await move("alice", given, puzzle[given], 3)).status).toBe(422);
  });

  it("counts a mistake once per guess, so no cell can be brute-forced", async () => {
    const { puzzle, solution } = await startDuel();
    const cell = puzzle.indexOf(0);
    const wrong = (offset: number) => ((solution[cell] + offset - 1) % 9) + 1;
    expect((await move("alice", cell, wrong(1), 1)).body.mistakes).toBe(1);
    expect((await move("alice", cell, wrong(1), 1)).body.mistakes).toBe(1); // a retry
    expect((await move("alice", cell, wrong(2), 1)).body.mistakes).toBe(2); // same id, other digit
    expect((await state("alice")).duel.mistakes).toBe(2);
    expect((await state("bob")).duel.mistakes).toBe(0);
  });

  it("gives the duel to the friend after three mistakes", async () => {
    const { puzzle, solution } = await startDuel();
    const cell = puzzle.indexOf(0);
    for (let n = 1; n <= 3; n++) await move("alice", cell, ((solution[cell] + n - 1) % 9) + 1, n);
    const { duel } = await state("bob");
    expect(duel).toMatchObject({
      status: "finished",
      winnerId: "bob",
      finishReason: "three_mistakes",
    });
    expect((await move("alice", cell, solution[cell], 9)).status).toBe(404); // nothing left to play
  });

  it("gives the duel to whoever completes the grid, not before the minimum time", async () => {
    const { solution } = await startDuel();
    expect((await as("bob", { action: "complete", grid: solution })).body.error).toBe("too_fast");
    vi.advanceTimersByTime(MIN_COMPLETE_SECONDS * 1000);
    const wrong = [...solution];
    [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
    expect((await as("bob", { action: "complete", grid: wrong })).status).toBe(422);
    expect((await as("bob", { action: "complete", grid: solution.slice(1) })).status).toBe(422);
    const done = await as("bob", { action: "complete", grid: solution });
    expect(done.body.duel).toMatchObject({
      status: "finished",
      winnerId: "bob",
      finishReason: "completed",
    });
    expect(done.body.duel.myFilled).toBe(done.body.duel.totalToFill);
    // Alice was a moment too late: the result stands.
    expect((await as("alice", { action: "complete", grid: solution })).status).toBe(404);
    expect((await state("alice")).duel.winnerId).toBe("bob");
  });

  it("lets a player give up", async () => {
    await startDuel();
    const { body } = await as("alice", { action: "forfeit" });
    expect(body.duel).toMatchObject({
      status: "finished",
      winnerId: "bob",
      finishReason: "forfeit",
    });
  });

  it("awards the duel to the player still there after two minutes of silence", async () => {
    await startDuel();
    for (let t = 0; t < FORFEIT_AFTER_MS + 30_000; t += 10_000) {
      vi.advanceTimersByTime(10_000);
      await state("alice"); // alice keeps polling, bob is gone
    }
    expect((await state("alice")).duel).toMatchObject({
      status: "finished",
      finishReason: "forfeit",
      winnerId: "alice",
    });
  });

  it("keeps the duel going while both players poll", async () => {
    await startDuel();
    for (let t = 0; t < FORFEIT_AFTER_MS * 2; t += 10_000) {
      vi.advanceTimersByTime(10_000);
      await state("alice");
      await state("bob");
    }
    expect((await state("alice")).duel.status).toBe("playing");
  });

  it("does not reward a player who left first and comes back", async () => {
    await startDuel();
    vi.advanceTimersByTime(30_000);
    await state("bob"); // bob seen last, then both leave
    vi.advanceTimersByTime(FORFEIT_AFTER_MS * 3);
    expect((await state("alice")).duel).toMatchObject({ status: "finished", winnerId: "bob" });
  });

  it("lets nobody else move in a duel", async () => {
    const { puzzle, solution } = await startDuel();
    const cell = puzzle.indexOf(0);
    expect((await move("carol", cell, solution[cell], 1)).status).toBe(404);
    expect((await as("carol", { action: "forfeit" })).status).toBe(404);
    expect((await as("carol", { action: "complete", grid: solution })).status).toBe(404);
    expect((await state("alice")).duel.status).toBe("playing");
  });
});

describe("results", () => {
  const playAndWin = async (winner: string) => {
    const { solution } = await startDuel();
    vi.advanceTimersByTime(MIN_COMPLETE_SECONDS * 1000);
    await as(winner, { action: "complete", grid: solution });
  };

  it("keeps the result on screen until each player closes it, and keeps the score", async () => {
    await playAndWin("bob");
    const bob = (await state("bob")).duel;
    expect(bob).toMatchObject({ status: "finished", record: { wins: 1, losses: 0 } });
    expect(bob.durationSeconds).toBeGreaterThanOrEqual(MIN_COMPLETE_SECONDS);
    expect((await state("alice")).duel.record).toEqual({ wins: 0, losses: 1 });

    expect((await as("alice", { action: "dismiss", id: bob.id })).body).toEqual({ ok: true });
    expect((await state("alice")).duel).toBeNull();
    expect((await state("bob")).duel.status).toBe("finished"); // Bob has not closed it
    expect((await as("carol", { action: "dismiss", id: bob.id })).status).toBe(404);
  });

  it("lets the players start again straight after, and adds up the score", async () => {
    await playAndWin("bob"); // Bob 1 - 0, result not closed
    await playAndWin("alice"); // a finished duel does not block a rematch: 1 - 1
    const rematch = await challenge("bob", "alice", "Intermédiaire");
    expect(rematch.body.ok).toBe(true);
    await answer("alice", "accept", rematch.body.id);
    const { solution } = db
      .prepare("SELECT solution FROM friend_duels WHERE id = ?")
      .get(rematch.body.id) as {
      solution: string;
    };
    vi.advanceTimersByTime(MIN_COMPLETE_SECONDS * 1000);
    await as("alice", { action: "complete", grid: solution.split("").map(Number) });
    expect((await state("alice")).duel.record).toEqual({ wins: 2, losses: 1 });
    expect((await state("bob")).duel.record).toEqual({ wins: 1, losses: 2 });
  });

  it("forgets results nobody closed after half an hour", async () => {
    await playAndWin("bob");
    vi.advanceTimersByTime(31 * 60_000);
    expect((await state("bob")).duel).toBeNull();
  });

  it("cannot dismiss a duel that is not over", async () => {
    const { id: duelId } = await startDuel();
    expect((await as("alice", { action: "dismiss", id: duelId })).body.error).toBe("not_finished");
  });
});
