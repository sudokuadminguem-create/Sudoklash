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
