import { env } from "cloudflare:workers";
import { premiumPacks } from "./premium";
export const paymentConfig = () => ({
  key: env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY,
  webhook: env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET,
  origin:
    env.PAYMENT_SITE_URL ||
    process.env.PAYMENT_SITE_URL ||
    "https://sudoklash.galletguemeric.chatgpt.site",
});
export const paymentsEnabled = () => {
  const c = paymentConfig();
  return (
    !!env.DB &&
    !!c.key?.startsWith("sk_live_") &&
    !!c.webhook?.startsWith("whsec_") &&
    /^https:\/\//.test(c.origin)
  );
};
type Session = {
  id: string;
  url?: string;
  payment_status: string;
  status: string;
  currency: string;
  amount_total: number;
  metadata?: { user_id?: string; pack_id?: string };
  client_reference_id?: string;
  livemode: boolean;
};
export async function retrieveSession(id: string): Promise<Session> {
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) throw Error("invalid_session");
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${paymentConfig().key}` },
  });
  if (!r.ok) throw Error("payment_unavailable");
  return (await r.json()) as Session;
}
export async function creditSession(id: string, expectedUser?: string) {
  const s = await retrieveSession(id);
  const pack = premiumPacks.find((p) => p.id === s.metadata?.pack_id),
    userId = s.metadata?.user_id;
  if (
    !pack ||
    !userId ||
    s.client_reference_id !== userId ||
    (expectedUser && expectedUser !== userId)
  )
    throw Error("wrong_owner");
  if (
    !s.livemode ||
    s.status !== "complete" ||
    s.payment_status !== "paid" ||
    s.currency !== "eur" ||
    s.amount_total !== pack.cents
  )
    throw Error("payment_not_confirmed");
  await env
    .DB!.prepare(
      "INSERT OR IGNORE INTO premium_credits (session_id,user_id,pack_id,gems,amount_cents,credited_at) VALUES (?,?,?,?,?,?)",
    )
    .bind(s.id, userId, pack.id, pack.gems, pack.cents, Date.now())
    .run();
  return { gems: pack.gems };
}
export async function verifySignature(raw: string, header: string, secret: string) {
  const parts = header.split(","),
    timestamp = parts.find((p) => p.startsWith("t="))?.slice(2),
    signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  for (const signature of signatures) {
    if (!/^[a-f0-9]{64}$/.test(signature)) continue;
    const bytes = new Uint8Array(signature.match(/../g)!.map((v) => parseInt(v, 16)));
    if (await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`${timestamp}.${raw}`)))
      return true;
  }
  return false;
}
