import { beforeEach, expect, it } from "vitest";
import { GET, POST } from "@/app/api/invitations/route";
import { POST as createProfile } from "@/app/api/profile/route";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;
const choose = (color: string | null) => callRoute(POST, { color });
const create = (username: string) => callRoute(createProfile, { username });

beforeEach(() => {
  db = installTestDatabase();
  signIn(null);
});

it("attributes a new account once and counts only an online completion", async () => {
  expect((await callRoute(GET)).status).toBe(401);
  signIn("host");
  await create("Host");
  const { code } = (await callRoute(GET)).body;
  expect((await callRoute(GET)).body.code).toBe(code);
  signIn("older", { signupInvite: code, accountCreatedAt: 1 });
  await create("Older");
  signIn("guest", { signupInvite: code, accountCreatedAt: Date.now() });
  await create("Guest");
  expect(db.prepare("SELECT user_id FROM player_profiles WHERE invited_by=?").all("host")).toEqual([
    { user_id: "guest" },
  ]);
  signIn("host");
  expect((await callRoute(GET)).body.count).toBe(0);
  db.prepare(
    "INSERT INTO solo_results (id,user_id,difficulty,elapsed_seconds,completed_at) VALUES (?,?,?,?,?)",
  ).run("p1", "guest", "Facile", 60, Date.now());
  db.prepare(
    "INSERT INTO solo_results (id,user_id,difficulty,elapsed_seconds,completed_at) VALUES (?,?,?,?,?)",
  ).run("p2", "guest", "Facile", 60, Date.now());
  expect((await callRoute(GET)).body.count).toBe(1);
});

it("allows one color per tier, preserves earlier choices, and requires 25 for gold", async () => {
  signIn("host");
  await create("Host");
  expect((await choose("electric")).status).toBe(403);
  for (let i = 1; i <= 25; i++) {
    db.prepare(
      "INSERT INTO player_profiles (user_id,username,username_key,created_at,invited_by) VALUES (?,?,?,?,?)",
    ).run("guest" + i, "guest" + i, "guest" + i, Date.now(), "host");
    db.prepare(
      "INSERT INTO solo_results (id,user_id,difficulty,elapsed_seconds,completed_at) VALUES (?,?,?,?,?)",
    ).run("finish" + i, "guest" + i, "Facile", 60, Date.now());
    if (i === 5) {
      expect((await choose("electric")).body.selected).toBe("electric");
      expect((await choose("mint")).status).toBe(409);
    }
    if (i === 24) expect((await choose("gold")).status).toBe(403);
  }
  expect((await choose("rose-gold")).body.selected).toBe("rose-gold");
  expect((await choose("electric")).body.rewards).toEqual([
    { tier: 5, color: "electric" },
    { tier: 25, color: "rose-gold" },
  ]);
  expect((await choose(null)).body.selected).toBeNull();
});
