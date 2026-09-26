import { join } from "node:path";
import { openSqliteD1 } from "./sqlite-d1";

// Stands in for the "cloudflare:workers" module when the app runs on Node (Docker).
// next.config.ts points the import here; on the hosting platform the real module is used.

const databasePath = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "sudoklash.db");
const migrationsDir = process.env.MIGRATIONS_DIR ?? join(process.cwd(), "drizzle");

export const env = {
  DB: openSqliteD1(databasePath, migrationsDir).d1,
  // No platform proxy strips `oai-authenticated-*` headers here, so anyone could forge them.
  PLATFORM_AUTH_HEADERS: "untrusted",
} satisfies Cloudflare.Env;
