import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { openSqliteD1 } from "./sqlite-d1";

// Stands in for the "cloudflare:workers" module when the app runs on Node (Docker).
// next.config.ts points the import here; on the hosting platform the real module is used.

let database: D1Database | undefined;

// Opened on first use rather than at import, so building the app never touches the file.
function openDatabase() {
  const path = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "sudoklash.db");
  mkdirSync(dirname(path), { recursive: true });
  const migrations = process.env.MIGRATIONS_DIR ?? join(process.cwd(), "drizzle");
  return openSqliteD1(path, migrations).d1;
}

export const env = {
  get DB() {
    return (database ??= openDatabase());
  },
  // No platform proxy strips `oai-authenticated-*` headers here, so anyone could forge them.
  PLATFORM_AUTH_HEADERS: "untrusted",
} satisfies Cloudflare.Env;
