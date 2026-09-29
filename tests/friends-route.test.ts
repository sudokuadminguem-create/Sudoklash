import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/friends/route";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;
const send = (username: unknown) => callRoute(POST, { action: "send", username });
const answer = (action: string, id: unknown) => callRoute(POST, { action, id });
const relationships = async () => (await callRoute(GET)).body.relationships;

beforeEach(() => {
  db = installTestDatabase();
  signIn("alice");
  const profile = db.prepare(
    "INSERT INTO player_profiles (user_id, username, username_key, created_at) VALUES (?, ?, ?, 1)",
  );
  for (const name of ["Alice", "Bob", "Carol", "Bobby"])
    profile.run(name.toLowerCase(), name, name.toLowerCase());
});

describe("friends: directory", () => {
  it("requires sign-in", async () => {
    signIn(null);
    expect((await callRoute(GET)).status).toBe(401);
  });

  it("lists other players but never the caller", async () => {
    const { players } = (await callRoute(GET)).body;
    expect(players.map((p: { username: string }) => p.username)).toEqual(["Bob", "Bobby", "Carol"]);
    expect(players[0]).toMatchObject({ avatarId: "nova" });
    expect(players[0].frameId).toMatch(/^rank-/);
  });

  it("searches by part of a name, ignoring case", async () => {
    const url = "http://test/api/friends?search=BOB";
    const { players } = (await callRoute(GET, undefined, url)).body;
    expect(players.map((p: { username: string }) => p.username)).toEqual(["Bob", "Bobby"]);
  });

  it("does not treat search text as SQL or wildcards", async () => {
    for (const search of ["%", "_", "' OR 1=1 --"]) {
      const url = `http://test/api/friends?search=${encodeURIComponent(search)}`;
      expect((await callRoute(GET, undefined, url)).body.players).toEqual([]);
    }
  });

  it("pages the directory fifty players at a time", async () => {
    const insert = db.prepare(
      "INSERT INTO player_profiles (user_id, username, username_key, created_at) VALUES (?, ?, ?, 1)",
    );
    for (let n = 0; n < 60; n++) insert.run(`u${n}`, `Player${n}`, `player${n}`);
    const first = (await callRoute(GET, undefined, "http://test/api/friends?search=player")).body;
    expect(first.players).toHaveLength(50);
    expect(first.nextOffset).toBe(50);
    const next = (
      await callRoute(GET, undefined, "http://test/api/friends?search=player&offset=50")
    ).body;
    expect(next.players).toHaveLength(10);
    expect(next.nextOffset).toBeNull();
  });
});

describe("friends: requests", () => {
  it("rejects unknown actions and bodies", async () => {
    expect((await callRoute(POST, { action: "remove", id: "x" })).status).toBe(400);
    expect((await callRoute(POST, "nope")).status).toBe(400);
    signIn(null);
    expect((await send("bob")).status).toBe(401);
  });

  it("validates the target of a request", async () => {
    expect((await send("")).body.error).toBe("invalid_username");
    expect((await send("x".repeat(21))).body.error).toBe("invalid_username");
    expect((await send(undefined)).body.error).toBe("invalid_username");
    expect((await send("nobody")).status).toBe(404);
    expect((await send("alice")).body.error).toBe("self_request");
  });

  it("sends a request by username in any case", async () => {
    expect((await send("  BOB ")).body).toEqual({ ok: true });
    const [request] = await relationships();
    expect(request).toMatchObject({ status: "pending", requester_id: "alice", username: "Bob" });
  });

  it("does not create duplicates in either direction", async () => {
    await send("bob");
    expect((await send("bob")).body.error).toBe("request_pending");
    signIn("bob");
    expect((await send("alice")).body.error).toBe("incoming_request");
    expect(db.prepare("SELECT COUNT(*) AS n FROM friendships").get()).toEqual({ n: 1 });
  });

  it("lets only the addressee accept, and only once", async () => {
    await send("bob");
    const { id } = (await relationships())[0];
    expect((await answer("accept", id)).status).toBe(404); // the sender cannot accept
    signIn("carol");
    expect((await answer("accept", id)).status).toBe(404); // nor a stranger
    signIn("bob");
    expect((await answer("accept", id)).body).toEqual({ ok: true });
    expect((await answer("decline", id)).status).toBe(404); // already answered
    expect((await relationships())[0].status).toBe("accepted");
    signIn("alice");
    expect((await send("bob")).body.error).toBe("already_friends");
  });

  it("requires an id to answer and allows a new request after a decline", async () => {
    expect((await callRoute(POST, { action: "accept" })).body.error).toBe("invalid_request");
    expect((await callRoute(POST, { action: "accept", id: 7 })).status).toBe(400);
    await send("bob");
    const { id } = (await relationships())[0];
    signIn("bob");
    await answer("decline", id);
    expect((await send("alice")).body).toEqual({ ok: true }); // Bob can now ask Alice
    expect((await relationships())[0]).toMatchObject({ status: "pending", requester_id: "bob" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM friendships").get()).toEqual({ n: 1 });
  });

  it("shows an avatar picture only once the friendship is accepted", async () => {
    db.prepare(
      "INSERT INTO player_avatar_images (user_id, image_data, updated_at) VALUES ('bob', 'data:image/png;base64,AAAA', 1)",
    ).run();
    await send("bob");
    const { id } = (await relationships())[0];
    expect((await relationships())[0].image).toBeNull();
    signIn("bob");
    await answer("accept", id);
    signIn("alice");
    expect((await relationships())[0].image).toBe("data:image/png;base64,AAAA");
  });
});
