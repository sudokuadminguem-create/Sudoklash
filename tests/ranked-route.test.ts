import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/ranked/route";
import { FORFEIT_AFTER_MS } from "@/lib/ranked-rules";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: ReturnType<typeof installTestDatabase>;

async function as(user: string, body?: unknown) {
  signIn(user);
  return callRoute(body === undefined ? GET : POST, body);
}

/** Queues alice then bob and returns their match. */
async function startMatch() {
  await as("alice", { action: "join" });
  vi.advanceTimersByTime(1000);
  const { body } = await as("bob", { action: "join" });
  expect(body.status).toBe("playing");
  const match = db.prepare("SELECT * FROM ranked_matches").get() as {
    puzzle: string;
    solution: string;
  };
  return { puzzle: match.puzzle.split("").map(Number), solution: match.solution };
}

beforeEach(() => {
  db = installTestDatabase();
  vi.useFakeTimers({ now: new Date("2026-09-26T10:00:00Z") });
});
afterEach(() => vi.useRealTimers());

describe("ranked matches", () => {
  it("pairs two players on a bank puzzle and hides the solution", async () => {
    await startMatch();
    const { body } = await as("alice");
    expect(body).toMatchObject({ status: "playing", opponentName: "Adversaire" });
    expect(body.solution).toBeUndefined();
  });

  it("checks digits, records progress and ends the match after three mistakes", async () => {
    const { puzzle, solution } = await startMatch();
    const empty = puzzle.indexOf(0);
    const right = Number(solution[empty]);
    const grid = puzzle.map((v, i) => (i === empty ? right : v));
    const ok = await as("alice", {
      action: "check",
      index: empty,
      number: right,
      mistakeId: id(1),
      grid,
    });
    expect(ok.body).toMatchObject({ correct: true, myFilled: 1 });
    for (let n = 1; n <= 3; n++) {
      const wrong = ((right + n - 1) % 9) + 1;
      const wrongGrid = puzzle.map((v, i) => (i === empty ? wrong : v));
      await as("bob", {
        action: "check",
        index: empty,
        number: wrong,
        mistakeId: id(n + 1),
        grid: wrongGrid,
      });
    }
    const { body } = await as("alice");
    expect(body).toMatchObject({ status: "finished", finishReason: "three_mistakes" });
    expect(body.pointsChange).toBeGreaterThan(0);
  });

  it("lets a player abandon", async () => {
    await startMatch();
    await as("bob", { action: "forfeit" });
    const { body } = await as("alice");
    expect(body).toMatchObject({ status: "finished", finishReason: "forfeit" });
    expect(body.winnerId).toBe("alice");
  });

  it("awards the match to the player still there after two minutes", async () => {
    await startMatch();
    for (let t = 0; t < FORFEIT_AFTER_MS + 30_000; t += 10_000) {
      vi.advanceTimersByTime(10_000);
      await as("alice"); // alice keeps polling, bob is gone
    }
    const { body } = await as("alice");
    expect(body).toMatchObject({ status: "finished", finishReason: "forfeit", winnerId: "alice" });
  });

  it("keeps the match going while both players answer", async () => {
    await startMatch();
    for (let t = 0; t < FORFEIT_AFTER_MS * 2; t += 10_000) {
      vi.advanceTimersByTime(10_000);
      await as("alice");
      await as("bob");
    }
    expect((await as("alice")).body.status).toBe("playing");
  });

  it("does not reward a player who left first and comes back", async () => {
    await startMatch();
    vi.advanceTimersByTime(30_000);
    await as("bob"); // bob seen last, then both leave
    vi.advanceTimersByTime(FORFEIT_AFTER_MS * 3);
    const { body } = await as("alice");
    expect(body).toMatchObject({ status: "finished", finishReason: "forfeit", winnerId: "bob" });
  });

  it("lets players queue again once a match is over", async () => {
    await startMatch();
    await as("bob", { action: "forfeit" });
    expect((await as("alice", { action: "join" })).body.status).toBe("waiting");
  });
});
