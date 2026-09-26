import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { env } from "./workers";

const migrations = fileURLToPath(new URL("../../drizzle", import.meta.url));

// Minimal D1 API over an in-memory SQLite database, with every migration applied.
class Statement {
  constructor(
    private db: Database.Database,
    private sql: string,
    private args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Statement(this.db, this.sql, args);
  }
  execute() {
    const statement = this.db.prepare(this.sql);
    if (statement.reader) {
      const results = statement.all(...this.args);
      return { results, meta: { changes: 0 } };
    }
    const info = statement.run(...this.args);
    return { results: [], meta: { changes: info.changes } };
  }
  async first<T>() {
    return (this.execute().results[0] as T | undefined) ?? null;
  }
  async all<T>() {
    return this.execute() as { results: T[]; meta: { changes: number } };
  }
  async run() {
    return this.execute();
  }
}

export function installTestDatabase() {
  const db = new Database(":memory:");
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    for (const sql of readFileSync(`${migrations}/${file}`, "utf8").split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) db.exec(sql);
  }
  const d1 = {
    prepare: (sql: string) => new Statement(db, sql),
    batch: async (statements: Statement[]) =>
      db.transaction(() => statements.map((statement) => statement.execute()))(),
  };
  (env as { DB: unknown }).DB = d1;
  return db;
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
