import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { premiumPacks } from "@/lib/premium";
import { paymentsEnabled, paymentConfig, creditSession } from "@/lib/premium-payments";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  return json({ available: paymentsEnabled() });
}
export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!paymentsEnabled()) return json({ error: "payments_not_configured" }, 503);
  const body = (await request.json().catch(() => null)) as {
    packId?: string;
    action?: string;
    sessionId?: string;
  } | null;
  try {
    if (body?.action === "verify" && body.sessionId)
      return json(await creditSession(body.sessionId, user.userId));
    const pack = premiumPacks.find((p) => p.id === body?.packId);
    if (!pack) return json({ error: "invalid_pack" }, 400);
    const { key, origin } = paymentConfig();
    const base = new URL(origin).origin;
    const form = new URLSearchParams({
      mode: "payment",
      success_url: `${base}/?premium_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?premium_cancelled=1`,
      client_reference_id: user.userId,
      "metadata[user_id]": user.userId,
      "metadata[pack_id]": pack.id,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": String(pack.cents),
      "line_items[0][price_data][product_data][name]": `${pack.gems} Sudogemmes — Sudoku Clash`,
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
    return json({ url: session.url });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && e.message === "wrong_owner"
            ? "wrong_owner"
            : e instanceof Error && e.message === "payment_not_confirmed"
              ? "payment_not_confirmed"
              : "payment_unavailable",
      },
      409,
    );
  }
}
