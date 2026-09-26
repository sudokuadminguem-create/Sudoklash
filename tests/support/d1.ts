import { fileURLToPath } from "node:url";
import { openSqliteD1 } from "@/lib/runtime/sqlite-d1";
import { env } from "./workers";

const migrations = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Fresh in-memory database with every migration, installed as the D1 binding. */
export function installTestDatabase() {
  const { d1, sqlite } = openSqliteD1(":memory:", migrations);
  (env as { DB: D1Database }).DB = d1;
  return sqlite;
}

/** Calls a route handler with a JSON body (POST) or none (GET). */
export async function callRoute(
  handler: (request: Request) => Promise<Response>,
  body?: unknown,
  url = "http://test/api",
) {
  const request =
    body === undefined
      ? new Request(url)
      : new Request(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
  const response = await handler(request);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: response.status, body: (await response.json()) as any };
}
