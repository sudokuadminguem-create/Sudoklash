import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// Cloudflare D1 API subset used by the app, over Node's built-in SQLite. D1 is SQLite, so
// the SQL and the drizzle/ migrations run unchanged when the app is self-hosted.

type Result<T> = { results: T[]; success: true; meta: { changes: number } };

class Statement {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: SQLInputValue[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new Statement(this.db, this.sql, params as SQLInputValue[]);
  }

  execute<T>(): Result<T> {
    const statement = this.db.prepare(this.sql);
    // Statements that return rows: SELECT, PRAGMA, and writes with RETURNING.
    if (statement.columns().length > 0) {
      const results = statement.all(...this.params) as T[];
      return { results, success: true, meta: { changes: 0 } };
    }
    const info = statement.run(...this.params);
    return { results: [], success: true, meta: { changes: Number(info.changes) } };
  }

  async first<T>(): Promise<T | null> {
    return this.execute<T>().results[0] ?? null;
  }
  async all<T>(): Promise<Result<T>> {
    return this.execute<T>();
  }
  async run(): Promise<Result<never>> {
    return this.execute<never>();
  }
}

/** Applies the drizzle/ migrations that have not run yet, in journal order. */
function migrate(db: DatabaseSync, migrationsDir: string) {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (tag TEXT PRIMARY KEY, applied_at INTEGER)");
  const applied = new Set(
    (db.prepare("SELECT tag FROM _migrations").all() as { tag: string }[]).map((row) => row.tag),
  );
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8"),
  ) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries) {
    if (applied.has(tag)) continue;
    const sql = readFileSync(join(migrationsDir, `${tag}.sql`), "utf8");
    db.exec("BEGIN");
    try {
      for (const part of sql.split("--> statement-breakpoint")) if (part.trim()) db.exec(part);
      db.prepare("INSERT INTO _migrations (tag, applied_at) VALUES (?, ?)").run(tag, Date.now());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${tag} failed`, { cause: error });
    }
  }
}

/** Opens (or creates) a SQLite database, brings its schema up to date and wraps it as D1. */
export function openSqliteD1(path: string, migrationsDir: string) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  migrate(db, migrationsDir);
  const d1 = {
    prepare: (sql: string) => new Statement(db, sql),
    // D1 runs a batch as one transaction.
    batch: async (statements: Statement[]) => {
      db.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { d1: d1 as unknown as D1Database, sqlite: db };
}
