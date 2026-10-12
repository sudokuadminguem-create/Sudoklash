import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { POST as checkout, GET as availability } from "@/app/api/premium/checkout/route";
import { POST as webhook } from "@/app/api/premium/webhook/route";
import { POST as purchase, GET as cosmetics } from "@/app/api/cosmetics/route";
import { verifySignature } from "@/lib/premium-payments";
import { premiumPacks } from "@/lib/premium";
import { callRoute, installTestDatabase } from "./support/d1";
import { signIn } from "./support/site-auth";
import { env } from "./support/workers";
let db: ReturnType<typeof installTestDatabase>;
const secret = "whsec_test_signature";
const session = {
  id: "cs_live_paid123",
  status: "complete",
  payment_status: "paid",
  currency: "eur",
  amount_total: 99,
  client_reference_id: "alice",
  metadata: { user_id: "alice", pack_id: "pocket" },
  livemode: true,
};
beforeEach(() => {
  db = installTestDatabase();
  signIn("alice");
  env.STRIPE_SECRET_KEY = "sk_live_teststub";
  env.STRIPE_WEBHOOK_SECRET = secret;
});
afterEach(() => {
  delete env.STRIPE_SECRET_KEY;
  delete env.STRIPE_WEBHOOK_SECRET;
  vi.unstubAllGlobals();
});
async function signature(raw: string, timestamp = Math.floor(Date.now() / 1000)) {
  const enc = new TextEncoder(),
    key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${raw}`)),
  );
  return `t=${timestamp},v1=${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
it("requires authentication and disables payment when configuration is missing", async () => {
  signIn(null);
  expect((await callRoute(checkout, { packId: "pocket" })).status).toBe(401);
  signIn("alice");
  delete env.STRIPE_SECRET_KEY;
  expect((await availability()).status).toBe(200);
  expect(await (await availability()).json()).toEqual({ available: false });
  expect((await callRoute(checkout, { packId: "pocket" })).status).toBe(503);
});
it("uses each canonical euro amount instead of amounts from the browser", async () => {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const body = new URLSearchParams(String(init.body));
    expect(body.get("line_items[0][price_data][currency]")).toBe("eur");
    return Response.json({ url: "https://checkout.stripe.com/c/pay" });
  });
  vi.stubGlobal("fetch", fetcher);
  for (const p of premiumPacks) {
    await callRoute(checkout, { packId: p.id, amount: 1, gems: 999999 });
    const form = new URLSearchParams(String(fetcher.mock.calls.at(-1)![1].body));
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe(String(p.cents));
  }
  expect((await callRoute(checkout, { packId: "fake" })).status).toBe(400);
});
it("credits a paid session once and isolates the two wallets", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(session)),
  );
  for (let i = 0; i < 2; i++)
    expect((await callRoute(checkout, { action: "verify", sessionId: session.id })).status).toBe(
      200,
    );
  const wallet = (await callRoute(cosmetics)).body;
  expect(wallet.gems).toBe(100);
  expect(wallet.coins).toBe(300);
  const bought = await callRoute(purchase, {
    action: "buy_frame",
    id: "shop-tidal",
    currency: "gems",
  });
  expect(bought.body.gems).toBe(75);
  expect(bought.body.coins).toBe(300);
  expect(
    (await callRoute(purchase, { action: "buy_frame", id: "shop-tidal", currency: "coins" })).body
      .coins,
  ).toBe(300);
  signIn("bob");
  expect((await callRoute(checkout, { action: "verify", sessionId: session.id })).status).toBe(409);
  expect((await callRoute(cosmetics)).body.gems).toBe(0);
});
it("does not credit unpaid or incorrectly priced sessions", async () => {
  for (const patch of [{ payment_status: "unpaid" }, { amount_total: 1 }, { livemode: false }]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ...session, ...patch })),
    );
    expect((await callRoute(checkout, { action: "verify", sessionId: session.id })).status).toBe(
      409,
    );
  }
  expect(db.prepare("SELECT COUNT(*) AS n FROM premium_credits").get()).toEqual({ n: 0 });
});
it("verifies the raw webhook signature and rejects altered or old payloads", async () => {
  const raw = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: session.id } },
  });
  const signed = await signature(raw);
  expect(await verifySignature(raw, signed, secret)).toBe(true);
  expect(await verifySignature(raw + " ", signed, secret)).toBe(false);
  expect(
    await verifySignature(raw, await signature(raw, Math.floor(Date.now() / 1000) - 301), secret),
  ).toBe(false);
  expect((await webhook(new Request("http://test", { method: "POST", body: raw }))).status).toBe(
    400,
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(session)),
  );
  for (let i = 0; i < 2; i++)
    expect(
      (
        await webhook(
          new Request("http://test", {
            method: "POST",
            headers: { "stripe-signature": signed },
            body: raw,
          }),
        )
      ).status,
    ).toBe(200);
  expect(db.prepare("SELECT COUNT(*) AS n FROM premium_credits").get()).toEqual({ n: 1 });
});

it("blocks premium purchases with insufficient gems without spending coins",async()=>{
 const r=await callRoute(purchase,{action:"buy_frame",id:"shop-tidal",currency:"gems"});
 expect(r.status).toBe(409);expect(r.body.error).toBe("not_enough_gems");
 expect((await callRoute(cosmetics)).body.coins).toBe(300);
});
