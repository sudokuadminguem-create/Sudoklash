import { beforeEach, expect, it } from "vitest";
import { GET, POST } from "@/app/api/rooms/route";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  signIn("host");
});
const send = (action: string, fields: Record<string, unknown> = {}) =>
  callRoute(POST, { action, ...fields });
it("enforces capacity and readiness, shares one Mini grid and records only the first winner", async () => {
  const { body: created } = await send("create", { variant: "mini", maxPlayers: 3 });
  const { id, code } = created.room;
  expect(created.room).toMatchObject({ puzzle: "", difficulty: "Mini 6×6", max_players: 3 });
  for (const name of ["guest1", "guest2"]) {
    signIn(name);
    expect((await send("join", { code })).status).toBe(200);
    expect((await send("start", { id })).status).toBe(403);
    await send("ready", { id, ready: true });
  }
  signIn("extra");
  expect((await send("join", { code })).status).toBe(409);
  expect((await callRoute(GET, undefined, `http://test/api/rooms?id=${id}`)).status).toBe(404);
  signIn("host");
  expect((await send("start", { id })).status).toBe(409);
  await send("ready", { id, ready: true });
  const { body: started } = await send("start", { id });
  expect(started.room.puzzle).toHaveLength(36);
  expect(started.room).not.toHaveProperty("solution");
  signIn("guest1");
  expect((await callRoute(GET, undefined, `http://test/api/rooms?id=${id}`)).body.room.puzzle).toBe(
    started.room.puzzle,
  );
  expect((await send("complete", { id, grid: "1".repeat(36) })).status).toBe(409);
  const { solution } = db.prepare("SELECT solution FROM private_rooms WHERE id=?").get(id) as {
    solution: string;
  };
  expect((await send("complete", { id, grid: solution })).body.room.winner_id).toBe("guest1");
  signIn("host");
  expect((await send("complete", { id, grid: solution })).status).toBe(409);
});
it("keeps the chosen classic level and preserves Killer cages", async () => {
  expect(
    (await send("create", { variant: "classic", difficulty: "Maître", maxPlayers: 9 })).status,
  ).toBe(400);
  expect(
    (await send("create", { variant: "classic", difficulty: "Maître", maxPlayers: 2 })).body.room
      .difficulty,
  ).toBe("Maître");
  const { body } = await send("create", { variant: "killer", maxPlayers: 2 });
  expect(
    (
      db.prepare("SELECT cages FROM private_rooms WHERE id=?").get(body.room.id) as {
        cages: string;
      }
    ).cages,
  ).not.toBe("[]");
});

/** A started two-player classic room, seen by the host. */
async function startedRoom() {
  const { body } = await send("create", {
    variant: "classic",
    difficulty: "Facile",
    maxPlayers: 2,
  });
  const { id, code } = body.room;
  signIn("guest");
  await send("join", { code });
  await send("ready", { id, ready: true });
  signIn("host");
  await send("ready", { id, ready: true });
  await send("start", { id });
  const room = db.prepare("SELECT puzzle, solution FROM private_rooms WHERE id=?").get(id) as {
    puzzle: string;
    solution: string;
  };
  return { id, ...room };
}

it("checks a digit of an empty cell against the room's solution", async () => {
  const { id, puzzle, solution } = await startedRoom();
  const index = puzzle.indexOf("0");
  const right = Number(solution[index]);
  expect((await send("check", { id, index, number: right })).body).toEqual({ correct: true });
  expect((await send("check", { id, index, number: (right % 9) + 1 })).body).toEqual({
    correct: false,
  });
  const given = puzzle.search(/[1-9]/);
  for (const fields of [
    { index: given, number: 1 },
    { index: 1.5, number: 1 },
    { index, number: 0 },
    { index, number: 10 },
    { index, number: "1" },
  ])
    expect((await send("check", { id, ...fields })).status).toBe(409);
});

it("records progress from the right digits only and keeps the best count", async () => {
  const { id, puzzle, solution } = await startedRoom();
  const grid = [...puzzle].map(Number);
  const empty = [...puzzle].flatMap((c, i) => (c === "0" ? [i] : []));
  grid[empty[0]] = Number(solution[empty[0]]);
  grid[empty[1]] = Number(solution[empty[1]]);
  grid[empty[2]] = (Number(solution[empty[2]]) % 9) + 1;
  expect((await send("progress", { id, grid })).body).toEqual({ ok: true });
  expect((await send("progress", { id, grid: [...puzzle].map(Number) })).status).toBe(200);
  const { progress } = db
    .prepare("SELECT progress FROM private_room_players WHERE room_id=? AND user_id='host'")
    .get(id) as { progress: number };
  expect(progress).toBe(2);
  expect((await send("progress", { id, grid: [1, 2, 3] })).status).toBe(409);
});

it("refuses moves before the start, unknown actions and invalid readiness", async () => {
  const { body } = await send("create", {
    variant: "classic",
    difficulty: "Facile",
    maxPlayers: 2,
  });
  const { id } = body.room;
  expect((await send("check", { id, index: 0, number: 1 })).status).toBe(409);
  expect((await send("progress", { id, grid: [] })).status).toBe(409);
  expect((await send("ready", { id, ready: "yes" })).status).toBe(409);
  expect((await send("teleport", { id })).status).toBe(409);
  expect((await send("toString", { id })).status).toBe(409);
  expect((await send("ready", { id: 42 })).status).toBe(400);
  expect((await send("ready", { id: "missing", ready: true })).status).toBe(404);
});
