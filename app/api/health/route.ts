import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

/** Liveness probe for the container: the app answers and its database is reachable. */
export async function GET() {
  try {
    await env.DB.prepare("SELECT 1").first();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
