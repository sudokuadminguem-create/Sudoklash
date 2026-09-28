import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { openSqliteD1 } from "@/lib/runtime/sqlite-d1";

const migrations = fileURLToPath(new URL("../drizzle", import.meta.url));
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("SQLite D1 adapter", () => {
  it("creates the schema once and keeps data across restarts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sudoklash-"));
    dirs.push(dir);
    const path = join(dir, "db.sqlite");
    const first = openSqliteD1(path, migrations);
    await first.d1
      .prepare(
        "INSERT INTO player_profiles (user_id, username, username_key, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind("u1", "Neo", "neo", 1)
      .run();
    first.sqlite.close();
    const second = openSqliteD1(path, migrations);
    expect(await second.d1.prepare("SELECT username FROM player_profiles").first()).toEqual({
      username: "Neo",
    });
    second.sqlite.close();
  });

  it("follows the D1 result shapes", async () => {
    const { d1 } = openSqliteD1(":memory:", migrations);
    const insert = d1.prepare(
      "INSERT INTO ranked_ratings (user_id, points, wins, losses, updated_at) VALUES (?, 0, 0, 0, 0)",
    );
    expect((await insert.bind("a").run()).meta.changes).toBe(1);
    const returning = await d1
      .prepare("UPDATE ranked_ratings SET points = 5 WHERE user_id = ? RETURNING user_id")
      .bind("a")
      .all<{ user_id: string }>();
    expect(returning.results).toEqual([{ user_id: "a" }]);
    expect(await d1.prepare("SELECT * FROM ranked_ratings WHERE user_id = 'x'").first()).toBeNull();
  });

  it("rolls a failing batch back entirely", async () => {
    const { d1 } = openSqliteD1(":memory:", migrations);
    const insert = (id: string) =>
      d1
        .prepare(
          "INSERT INTO ranked_ratings (user_id, points, wins, losses, updated_at) VALUES (?, 0, 0, 0, 0)",
        )
        .bind(id);
    await expect(d1.batch([insert("a"), insert("a")])).rejects.toThrow();
    expect(await d1.prepare("SELECT COUNT(*) AS n FROM ranked_ratings").first()).toEqual({ n: 0 });
  });
});
