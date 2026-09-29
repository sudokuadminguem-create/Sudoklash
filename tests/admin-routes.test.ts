import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as majestic } from "@/app/api/admin/majestueux/route";
import { GET as challengesGet, POST as challengesPost } from "@/app/api/admin/challenges/route";
import { GET as me } from "@/app/api/me/route";
import { challengeDefaults } from "@/lib/challenges";
import { solveGrid } from "@/lib/sudoku-solver";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let admin: { displayName: string } | null = null;
vi.mock("@/app/admin/auth", () => ({ getAdminUser: async () => admin }));

let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  admin = null;
  signIn("alice");
});

const setChallenge = (body: unknown) => callRoute(challengesPost, body);
const puzzle = challengeDefaults.daily.puzzle;

describe("admin routes hide themselves from everyone else", () => {
  it("answers 404, not 401 or 403, to anyone who is not the owner", async () => {
    expect((await callRoute(challengesGet)).status).toBe(404);
    expect((await setChallenge({ kind: "daily", title: "Hacked", puzzle })).status).toBe(404);
    expect((await callRoute(majestic)).status).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS n FROM challenge_settings").get()).toEqual({ n: 0 });
  });

  it("does not let a signed-out visitor through either", async () => {
    signIn(null);
    expect((await callRoute(challengesGet)).status).toBe(404);
    expect((await setChallenge({ kind: "weekly", title: "x", puzzle })).status).toBe(404);
  });
});

describe("admin challenges", () => {
  beforeEach(() => {
    admin = { displayName: "Owner" };
  });

  it("returns the defaults until something is saved", async () => {
    expect((await callRoute(challengesGet)).body).toEqual({
      daily: challengeDefaults.daily,
      weekly: challengeDefaults.weekly,
    });
  });

  it("saves a title and a puzzle with a single solution", async () => {
    const saved = await setChallenge({
      kind: "daily",
      title: "  Mon défi  ",
      puzzle: ` ${puzzle} `,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.value).toEqual({ title: "Mon défi", puzzle });
    expect((await callRoute(challengesGet)).body.daily).toEqual({ title: "Mon défi", puzzle });
    expect((await callRoute(challengesGet)).body.weekly).toEqual(challengeDefaults.weekly);
  });

  it("replaces the previous grid instead of adding a row", async () => {
    await setChallenge({ kind: "weekly", title: "Un", puzzle });
    await setChallenge({ kind: "weekly", title: "Deux", puzzle: challengeDefaults.weekly.puzzle });
    expect(db.prepare("SELECT COUNT(*) AS n FROM challenge_settings").get()).toEqual({ n: 1 });
    expect((await callRoute(challengesGet)).body.weekly.title).toBe("Deux");
  });

  it("truncates very long titles", async () => {
    const { body } = await setChallenge({ kind: "daily", title: "x".repeat(200), puzzle });
    expect(body.value.title).toHaveLength(80);
  });

  it("rejects unknown kinds, missing titles and bad grids", async () => {
    expect((await setChallenge({ kind: "monthly", title: "x", puzzle })).body.error).toBe(
      "invalid_kind",
    );
    expect((await setChallenge(null)).body.error).toBe("invalid_kind");
    expect((await setChallenge({ kind: "daily", title: "   ", puzzle })).body.error).toBe(
      "missing_title",
    );
    expect(
      (await setChallenge({ kind: "daily", title: "x", puzzle: "0".repeat(81) })).body.error,
    ).toBe("invalid_puzzle"); // empty grid: many solutions
    expect((await setChallenge({ kind: "daily", title: "x", puzzle: "1".repeat(81) })).status).toBe(
      400,
    );
    expect(
      (await setChallenge({ kind: "daily", title: "x", puzzle: puzzle.slice(1) })).status,
    ).toBe(400);
    expect((await setChallenge({ kind: "daily", title: "x", puzzle: 12 })).status).toBe(400);
    expect(db.prepare("SELECT COUNT(*) AS n FROM challenge_settings").get()).toEqual({ n: 0 });
  });

  it("makes the saved grid the one players receive", async () => {
    const { GET } = await import("@/app/api/daily/route");
    await setChallenge({ kind: "daily", title: "Custom", puzzle });
    const served = (await callRoute(GET)).body;
    expect(served.title).toBe("Custom");
    // The grid is shuffled by symmetry for the period, but still has one solution.
    expect(solveGrid(served.puzzle)).not.toBeNull();
  });
});

describe("admin majestic frames", () => {
  it("lists only the majestic catalogue for the owner", async () => {
    admin = { displayName: "Owner" };
    const { status, body } = await callRoute(majestic);
    expect(status).toBe(200);
    expect(body.achievements.length).toBeGreaterThan(0);
    expect(body.achievements.every((a: { rarity: string }) => a.rarity === "majestic")).toBe(true);
  });
});

describe("/api/me", () => {
  it("reports anonymous, player and owner states", async () => {
    signIn(null);
    expect((await callRoute(me)).body).toEqual({
      signedIn: false,
      isAdmin: false,
      displayName: null,
    });
    signIn("alice");
    expect((await callRoute(me)).body).toEqual({
      signedIn: true,
      isAdmin: false,
      displayName: "alice",
    });
    admin = { displayName: "Owner" };
    expect((await callRoute(me)).body).toEqual({
      signedIn: true,
      isAdmin: true,
      displayName: "Owner",
    });
  });
});
