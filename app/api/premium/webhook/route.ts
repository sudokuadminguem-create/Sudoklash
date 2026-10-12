import {
  paymentConfig,
  paymentsEnabled,
  verifySignature,
  creditSession,
} from "@/lib/premium-payments";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!paymentsEnabled())
    return Response.json({ error: "payments_not_configured" }, { status: 503 });
  const raw = await request.text();
  if (
    raw.length > 1000000 ||
    !(await verifySignature(
      raw,
      request.headers.get("stripe-signature") ?? "",
      paymentConfig().webhook!,
    ))
  )
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  let event: { type: string; data: { object: { id: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (
    !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)
  )
    return Response.json({ received: true });
  try {
    await creditSession(event.data.object.id);
    return Response.json({ received: true });
  } catch (e) {
    if (e instanceof Error && e.message === "payment_not_confirmed")
      return Response.json({ received: true });
    return Response.json({ error: "credit_failed" }, { status: 503 });
  }
}
