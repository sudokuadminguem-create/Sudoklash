import { beforeEach, expect, it } from "vitest";
import { GET, POST } from "@/app/api/cosmetics/route";
import { bundlePrice } from "@/lib/premium-collections";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";
let db: ReturnType<typeof installTestDatabase>;
beforeEach(() => {
  db = installTestDatabase();
  signIn("alice");
  db.prepare("INSERT INTO premium_credits VALUES ('session','alice','deluxe',1300,1000,1)").run();
});
const buy = (id: string) => callRoute(POST, { action: "buy_premium", id, currency: "gems" });
it("buys all three collection items once without consuming coins", async () => {
  const r = await buy("premium-dragon-bundle");
  expect(r.status).toBe(200);
  expect(r.body.gems).toBe(1110);
  expect(r.body.coins).toBe(300);
  expect(r.body.unlockedFrames).toContain("premium-dragon-frame");
  expect(r.body.ownedCards).toContain("premium-dragon-card");
  expect(r.body.ownedEffects).toContain("premium-dragon-effect");
  expect((await buy("premium-dragon-effect")).body.gems).toBe(1110);
  expect((await buy("premium-dragon-bundle")).body.gems).toBe(1110);
  for (const [action, id] of [
    ["equip_frame", "premium-dragon-frame"],
    ["equip_profile_card", "premium-dragon-card"],
    ["equip_effect", "premium-dragon-effect"],
  ])
    expect((await callRoute(POST, { action, id })).status).toBe(200);
  const look = (await callRoute(GET)).body;
  expect(look.frameId).toBe("premium-dragon-frame");
  expect(look.profileCardId).toBe("premium-dragon-card");
  expect(look.victoryEffectId).toBe("premium-dragon-effect");
  signIn("bob");
  expect((await callRoute(GET)).body.ownedCards).not.toContain("premium-dragon-card");
});
it("discounts a partially owned collection and does not resell the owned component", async () => {
  await buy("premium-cosmic-frame");
  expect(bundlePrice("cosmic", ["premium-cosmic-frame"])).toBe(119);
  expect((await buy("premium-cosmic-bundle")).body.gems).toBe(1091);
  expect((await buy("premium-cosmic-card")).body.gems).toBe(1091);
});
it("rejects invented products and locked effects", async () => {
  expect((await buy("challenge-l-026")).status).toBe(400);
  expect(
    (
      await callRoute(POST, {
        action: "buy_premium",
        id: "premium-dragon-frame",
        currency: "coins",
      })
    ).status,
  ).toBe(400);
  expect(
    (await callRoute(POST, { action: "equip_effect", id: "premium-dragon-effect" })).status,
  ).toBe(403);
  expect((await callRoute(GET)).body.gems).toBe(1300);
});
it("does not allow concurrent singles and bundles to double-charge for the same collection", async () => {
  const results = await Promise.all([buy("premium-pirate-bundle"), buy("premium-pirate-frame")]);
  expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  const state = (await callRoute(GET)).body;
  expect([1110, 1210]).toContain(state.gems);
});
