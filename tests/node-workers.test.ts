import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "sudoklash-node-workers-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

it("opens the SQLite database on first use and keeps it for later calls", async () => {
  process.env.DATABASE_PATH = join(dir, "nested", "sudoklash.db");
  try {
    const { env } = await import("@/lib/runtime/node-workers");
    const db = env.DB;
    expect(env.DB).toBe(db);
    const row = await db.prepare("SELECT 1 AS one").first<{ one: number }>();
    expect(row?.one).toBe(1);
  } finally {
    delete process.env.DATABASE_PATH;
  }
});
