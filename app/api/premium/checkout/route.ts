import { getSiteUser } from "@/app/supabase-auth";
import { premiumPacks, supportPacks } from "@/lib/premium";
import { paymentsEnabled, paymentConfig, creditSession } from "@/lib/premium-payments";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function GET() {
  return json({ available: paymentsEnabled() });
}
type Pack = { id: string; cents: number; gems?: number };

/** Opens a Stripe Checkout session for a pack and returns the URL the player is sent to. */
async function openCheckout(userId: string, pack: Pack, support: boolean) {
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
    "line_items[0][price_data][product_data][name]": support
      ? "Soutien à Sudoklash"
      : `${pack.gems} Sudogemmes — Sudoklash`,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!response.ok) throw new Error("payment_unavailable");
  const session = (await response.json()) as { url?: string };
  if (!session.url || new URL(session.url).hostname !== "checkout.stripe.com")
    throw new Error("invalid_checkout");
  return session.url;
}

const reportedErrors = new Set(["wrong_owner", "payment_not_confirmed"]);

/** The error code sent back to the browser: the known ones as is, anything else as unavailable. */
function paymentError(error: unknown) {
  return error instanceof Error && reportedErrors.has(error.message)
    ? error.message
    : "payment_unavailable";
}

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
    return json({ url: await openCheckout(user.userId, pack, Boolean(support)) });
  } catch (e) {
    return json({ error: paymentError(e) }, 409);
  }
}
