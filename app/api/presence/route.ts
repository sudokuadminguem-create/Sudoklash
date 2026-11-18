import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
const token = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const response = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const db = env.DB;
  if (!db) return response({ error: "unavailable" }, 503);
  const body = (await request.json().catch(() => null)) as {
    tabId?: unknown;
    browserId?: unknown;
    revision?: unknown;
    active?: unknown;
  } | null;
  if (
    !body ||
    typeof body.tabId !== "string" ||
    !token.test(body.tabId) ||
    typeof body.browserId !== "string" ||
    !token.test(body.browserId) ||
    typeof body.revision !== "number" ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 1 ||
    typeof body.active !== "boolean"
  )
    return response({ error: "invalid_presence" }, 400);
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM live_presence WHERE seen_at < ?").bind(now - 120_000),
    db
      .prepare(
        `INSERT INTO live_presence (tab_id,browser_id,revision,active,seen_at)
      VALUES (?,?,?,?,?) ON CONFLICT(tab_id) DO UPDATE SET revision=excluded.revision,active=excluded.active,seen_at=excluded.seen_at
      WHERE live_presence.browser_id=excluded.browser_id AND excluded.revision>live_presence.revision`,
      )
      .bind(body.tabId, body.browserId, body.revision, Number(body.active), now),
  ]);
  if (!body.active) return new Response(null, { status: 204 });
  const row = await db
    .prepare(
      "SELECT COUNT(DISTINCT browser_id) AS count FROM live_presence WHERE active=1 AND seen_at>?",
    )
    .bind(now - 25_000)
    .first<{ count: number }>();
  return response({ count: row?.count ?? 0 });
}
