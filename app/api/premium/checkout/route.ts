import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { premiumPacks, supportPacks } from "@/lib/premium";
import { paymentsEnabled, paymentConfig, creditSession } from "@/lib/premium-payments";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  return json({ available: paymentsEnabled() });
}
type Pack = { id: string; cents: number; gems?: number };

async function createCheckout(userId: string, pack: Pack, support: boolean) {
  const { key, origin } = paymentConfig();
  const base = new URL(origin).origin;
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${base}/?${support ? "support_session" : "premium_session"}={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?${support ? "support_cancelled" : "premium_cancelled"}=1`,
    client_reference_id: userId,
    "metadata[user_id]": userId,
    "metadata[pack_id]": pack.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(pack.cents),
    "line_items[0][price_data][product_data][name]": support ? "Soutien à Sudoku Clash" : `${pack.gems} Sudogemmes — Sudoku Clash`,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!response.ok) throw Error("payment_unavailable");
  const session = (await response.json()) as { url?: string };
  if (!session.url || new URL(session.url).hostname !== "checkout.stripe.com")
    throw Error("invalid_checkout");
  return session.url;
}

const REPORTED_ERRORS = new Set(["wrong_owner", "payment_not_confirmed"]);
const paymentError = (e: unknown) =>
  e instanceof Error && REPORTED_ERRORS.has(e.message) ? e.message : "payment_unavailable";

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!paymentsEnabled()) return json({ error: "payments_not_configured" }, 503);
  const body = (await request.json().catch(() => null)) as {
    packId?: string;
    publishSupport?: boolean;
    action?: string;
    sessionId?: string;
  } | null;
  try {
    if (body?.action === "verify" && body.sessionId)
      return json(await creditSession(body.sessionId, user.userId));
    const support = supportPacks.find((p) => p.id === body?.packId);
    if (support && body?.publishSupport !== true) return json({ error: "consent_required" }, 400);
    const pack = support ?? premiumPacks.find((p) => p.id === body?.packId);
    if (!pack) return json({ error: "invalid_pack" }, 400);
    return json({ url: await createCheckout(user.userId, pack, Boolean(support)) });
  } catch (e) {
    return json({ error: paymentError(e) }, 409);
  }
}
