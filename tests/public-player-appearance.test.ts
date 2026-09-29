import { beforeEach, describe, expect, it } from "vitest";
import { GET as photo } from "@/app/api/players/avatar/route";
import { GET as leaderboard } from "@/app/api/players/leaderboard/route";
import { GET as appearance } from "@/app/api/players/appearance/route";
import { installTestDatabase } from "./support/d1";

const id = "00000000-0000-4000-8000-000000000001";
let db: ReturnType<typeof installTestDatabase>;

beforeEach(() => {
  db = installTestDatabase();
  db.prepare(
    "INSERT INTO player_profiles(user_id,username,username_key,created_at) VALUES (?, 'Photo', 'photo', 1)",
  ).run(id);
  db.prepare(
    "INSERT INTO player_cosmetics(user_id,avatar_id,frame_id,theme_id,profile_card_id,profile_title_id) VALUES (?, 'custom', 'challenge-e-001', 'ocean', 'arena', 'flash')",
  ).run(id);
  db.prepare(
    "INSERT INTO player_avatar_images(user_id,image_data,updated_at) VALUES (?, 'data:image/webp;base64,AAAA', 1)",
  ).run(id);
  db.prepare(
    "INSERT INTO ranked_ratings(user_id,points,wins,losses,updated_at) VALUES (?, 400, 3, 1, 1)",
  ).run(id);
});

describe("public player appearance", () => {
  it("shows the equipped photo and frame in profiles and ranking", async () => {
    const expected = {
      avatarId: "custom",
      frameId: "challenge-e-001",
      image: `/api/players/avatar?id=${id}`,
    };
    const looks = await appearance(new Request(`http://test/api/players/appearance?ids=${id}`));
    expect(((await looks.json()) as { appearances: unknown[] }).appearances[0]).toMatchObject(expected);
    const ranking = await leaderboard();
    expect(((await ranking.json()) as { players: unknown[] }).players[0]).toMatchObject(expected);
    const response = await photo(new Request(`http://test/api/players/avatar?id=${id}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("does not serve an uploaded photo when another avatar is equipped", async () => {
    db.prepare("UPDATE player_cosmetics SET avatar_id='nova' WHERE user_id=?").run(id);
    const response = await photo(new Request(`http://test/api/players/avatar?id=${id}`));
    expect(response.status).toBe(404);
    const ranking = await leaderboard();
    expect(((await ranking.json()) as { players: { image: string | null }[] }).players[0].image).toBeNull();
  });
});
