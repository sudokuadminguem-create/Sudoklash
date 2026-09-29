import { beforeEach, describe, expect, it } from "vitest";
import { GET as directory } from "@/app/api/friends/route";
import { GET as profile } from "@/app/api/friends/profile/route";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";

let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  signIn("alice");
  db.prepare("INSERT INTO player_profiles(user_id,username,username_key,created_at) VALUES ('bob','Bob','bob',1)").run();
  db.prepare("INSERT INTO player_cosmetics(user_id,avatar_id,frame_id,theme_id,profile_card_id,profile_title_id) VALUES ('bob','custom','challenge-e-001','ocean','arena','flash')").run();
  db.prepare("INSERT INTO player_avatar_images(user_id,image_data,updated_at) VALUES ('bob','data:image/webp;base64,AAAA',1)").run();
});

describe("friend profiles", () => {
  it("does not expose a full profile before a friendship is accepted", async () => {
    const result = await callRoute(profile, undefined, "http://test/api/friends/profile?id=bob");
    expect(result.status).toBe(403);
  });

  it("shows the selected picture, frame and profile card after acceptance", async () => {
    db.prepare("INSERT INTO friendships(id,pair_key,requester_id,addressee_id,status,created_at) VALUES ('f1','alice:bob','alice','bob','accepted',1)").run();
    const card = await callRoute(profile, undefined, "http://test/api/friends/profile?id=bob");
    expect(card.status).toBe(200);
    expect(card.body).toMatchObject({ username: "Bob", avatarId: "custom", frameId: "challenge-e-001", profileCardId: "arena", profileTitleId: "flash", image: "data:image/webp;base64,AAAA" });
    const list = await callRoute(directory);
    expect(list.body.relationships[0]).toMatchObject({ username: "Bob", avatarId: "custom", frameId: "challenge-e-001", image: "/api/players/avatar?id=bob" });
  });
});

