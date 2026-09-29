import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/cosmetics/route";
import { env } from "./support/workers";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;

/** Gives the player finished solo games so they earn coins (20 coins each, 300 to start). */
function finishSoloGames(userId: string, count: number) {
  for (let n = 0; n < count; n++)
    db.prepare(
      "INSERT INTO solo_results (id, user_id, difficulty, elapsed_seconds, completed_at) VALUES (?, ?, 'Facile', 300, ?)",
    ).run(`${userId}-game-${n}`, userId, n + 1);
}

const post = (action: string, id: string) => callRoute(POST, { action, id });

beforeEach(() => {
  db = installTestDatabase();
  signIn("alice");
});

describe("cosmetics: access", () => {
  it("requires sign-in for reads and writes", async () => {
    signIn(null);
    expect((await callRoute(GET)).status).toBe(401);
    expect((await post("equip_avatar", "nova")).status).toBe(401);
  });

  it("reports an unavailable database", async () => {
    const binding = env.DB;
    (env as { DB?: D1Database }).DB = undefined;
    try {
      expect((await callRoute(GET)).status).toBe(503);
      expect((await post("equip_avatar", "nova")).status).toBe(503);
    } finally {
      (env as { DB?: D1Database }).DB = binding;
    }
  });

  it("rejects malformed requests and unknown actions", async () => {
    expect((await callRoute(POST, { action: "equip_avatar" })).status).toBe(400);
    expect((await callRoute(POST, { id: "nova" })).status).toBe(400);
    expect((await callRoute(POST, { action: 3, id: "nova" })).status).toBe(400);
    const unknown = await post("give_coins", "nova");
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toBe("invalid_action");
  });
});

describe("cosmetics: default state", () => {
  it("starts a new player with the free items and 300 coins", async () => {
    const { status, body } = await callRoute(GET);
    expect(status).toBe(200);
    expect(body.coins).toBe(300);
    expect(body.level).toBe(1);
    expect(body.avatarId).toBe("nova");
    expect(body.themeId).toBe("ocean");
    expect(body.frameSelection).toBe("rank_auto");
    expect(body.ownedThemes).toEqual(["ocean"]);
    expect(body.ownedAvatars).toContain("nova");
    expect(body.ownedAvatars).not.toContain("neon");
    expect(body.customAvatar).toBeNull();
  });

  it("earns coins and unlocks avatars from finished games", async () => {
    finishSoloGames("alice", 10);
    const { body } = await callRoute(GET);
    expect(body.coins).toBe(300 + 10 * 20);
    expect(body.ownedAvatars).toContain("solver");
  });
});

describe("cosmetics: equipping", () => {
  it("refuses items the player does not own", async () => {
    expect((await post("equip_avatar", "neon")).body.error).toBe("avatar_locked");
    expect((await post("equip_avatar", "custom")).body.error).toBe("avatar_locked");
    expect((await post("equip_avatar", "not-an-avatar")).status).toBe(403);
    expect((await post("equip_theme", "tokyo")).body.error).toBe("theme_locked");
    expect((await post("equip_frame", "gold")).body.error).toBe("frame_locked");
    expect((await post("equip_profile_card", "arena")).body.error).toBe("reward_locked");
    expect((await post("equip_profile_title", "flash")).body.error).toBe("reward_locked");
  });

  it("equips a free avatar and keeps it across reads", async () => {
    const equipped = await post("equip_avatar", "rook");
    expect(equipped.status).toBe(200);
    expect(equipped.body.avatarId).toBe("rook");
    expect((await callRoute(GET)).body.avatarId).toBe("rook");
  });

  it("only allows frames the level or an achievement unlocked, plus the automatic ones", async () => {
    expect((await post("equip_frame", "none")).body.frameSelection).toBe("none");
    expect((await post("equip_frame", "rank_auto")).body.frameSelection).toBe("rank_auto");
    expect((await post("equip_frame", "starter")).body.frameSelection).toBe("starter");
    expect((await post("equip_frame", "legendary")).status).toBe(403);
  });

  it("falls back to the default when a saved avatar is no longer owned", async () => {
    db.prepare(
      "INSERT INTO player_cosmetics (user_id, avatar_id, frame_id, theme_id) VALUES ('alice', 'crown', 'rank_auto', 'galaxy')",
    ).run();
    const { body } = await callRoute(GET);
    expect(body.avatarId).toBe("nova");
    expect(body.themeId).toBe("ocean");
  });

  it("keeps each player's selection separate", async () => {
    await post("equip_avatar", "rook");
    signIn("bob");
    expect((await callRoute(GET)).body.avatarId).toBe("nova");
  });
});

describe("cosmetics: shop", () => {
  it("rejects items that do not exist", async () => {
    expect((await post("buy_avatar", "nova")).body.error).toBe("invalid_item");
    expect((await post("buy_avatar", "nope")).status).toBe(400);
    expect((await post("buy_theme", "neon")).status).toBe(400);
  });

  it("buys an avatar with coins and lets the player equip it", async () => {
    const bought = await post("buy_avatar", "neon");
    expect(bought.status).toBe(200);
    expect(bought.body.coins).toBe(0);
    expect(bought.body.ownedAvatars).toContain("neon");
    expect((await post("equip_avatar", "neon")).body.avatarId).toBe("neon");
  });

  it("refuses a purchase the balance cannot cover", async () => {
    const { status, body } = await post("buy_avatar", "crown");
    expect(status).toBe(409);
    expect(body.error).toBe("not_enough_coins");
    expect(db.prepare("SELECT COUNT(*) AS n FROM cosmetic_purchases").get()).toEqual({ n: 0 });
  });

  it("does not charge twice for an item already owned", async () => {
    await post("buy_avatar", "neon");
    const again = await post("buy_avatar", "neon");
    expect(again.status).toBe(200);
    expect(again.body.coins).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM cosmetic_purchases").get()).toEqual({ n: 1 });
  });

  it("cannot spend the same balance twice on two items", async () => {
    // 300 coins: the neon avatar (300) leaves nothing for the obsidian theme (700).
    await post("buy_avatar", "neon");
    const second = await post("buy_theme", "obsidian");
    expect(second.status).toBe(409);
    expect(db.prepare("SELECT SUM(price) AS total FROM cosmetic_purchases").get()).toEqual({
      total: 300,
    });
  });

  it("buys a theme once the balance allows it", async () => {
    finishSoloGames("alice", 20); // 300 + 400 = 700 coins
    const bought = await post("buy_theme", "obsidian");
    expect(bought.body.coins).toBe(0);
    expect(bought.body.ownedThemes).toContain("obsidian");
    expect((await post("equip_theme", "obsidian")).body.themeId).toBe("obsidian");
  });
});

describe("cosmetics: uploaded avatars", () => {
  const image = "data:image/png;base64,iVBORw0KGgo=";

  it("stores a valid image and equips it", async () => {
    const { status, body } = await post("upload_avatar", image);
    expect(status).toBe(200);
    expect(body.customAvatar).toBe(image);
    expect(body.avatarId).toBe("custom");
  });

  it("rejects anything that is not a small png, jpeg or webp data URL", async () => {
    for (const bad of [
      "https://example.com/a.png",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:image/gif;base64,R0lGODlh",
      "data:text/html;base64,PGI+",
      "data:image/png;base64,not base64!",
      `data:image/png;base64,${"A".repeat(200_001)}`,
    ])
      expect((await post("upload_avatar", bad)).body.error).toBe("invalid_image");
    expect(db.prepare("SELECT COUNT(*) AS n FROM player_avatar_images").get()).toEqual({ n: 0 });
  });

  it("removes the image and goes back to the default avatar", async () => {
    await post("upload_avatar", image);
    const removed = await post("remove_avatar", "custom");
    expect(removed.body.customAvatar).toBeNull();
    expect(removed.body.avatarId).toBe("nova");
  });
});
