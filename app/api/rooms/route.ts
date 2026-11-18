import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { isSoloDifficulty } from "@/lib/difficulties";
import { isVariantId, variantInfo } from "@/lib/variants";
import { pickPuzzle } from "@/lib/puzzle-picker";
import { pickVariantGame } from "@/lib/variant-picker";

export const dynamic = "force-dynamic";
type Room = {
  id: string;
  code: string;
  host_id: string;
  max_players: number;
  difficulty: string;
  variant: string;
  puzzle: string;
  solution: string;
  cages: string;
  started_at: number | null;
  winner_id: string | null;
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const expiry = () => Date.now() - 86400000;

async function snapshot(db: D1Database, id: string, user: string) {
  const room = await db
    .prepare(
      "SELECT r.* FROM private_rooms r JOIN private_room_players p ON p.room_id=r.id WHERE r.id=? AND p.user_id=? AND r.created_at>?",
    )
    .bind(id, user, expiry())
    .first<Room>();
  if (!room) return fail("Salon introuvable ou expiré.", 404);
  const players = await db
    .prepare(
      "SELECT m.user_id,m.is_ready,m.progress,p.username FROM private_room_players m LEFT JOIN player_profiles p ON p.user_id=m.user_id WHERE m.room_id=? ORDER BY m.user_id",
    )
    .bind(id)
    .all();
  return json({
    room: {
      id: room.id,
      code: room.code,
      host_id: room.host_id,
      max_players: room.max_players,
      difficulty: room.difficulty,
      variant: room.variant,
      puzzle: room.started_at ? room.puzzle : "",
      cages: room.started_at ? JSON.parse(room.cages) : [],
      started_at: room.started_at,
      winner_id: room.winner_id,
    },
    players: players.results,
  });
}

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return fail("Connecte-toi pour jouer.", 401);
  if (!env.DB) return fail("Salons indisponibles.", 503);
  return snapshot(env.DB, new URL(request.url).searchParams.get("id") ?? "", user.userId);
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return fail("Connecte-toi pour jouer.", 401);
  const db = env.DB;
  if (!db) return fail("Salons indisponibles.", 503);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return fail("Demande invalide.");
  if (b.action === "create") {
    const { difficulty, variant, maxPlayers } = b;
    if (
      typeof maxPlayers !== "number" ||
      !Number.isInteger(maxPlayers) ||
      maxPlayers < 2 ||
      maxPlayers > 8 ||
      !(variant === "classic" ? isSoloDifficulty(difficulty) : isVariantId(variant))
    )
      return fail("Réglages invalides.");
    const id = crypto.randomUUID(),
      code = id.slice(0, 6).toUpperCase();
    const game = isVariantId(variant)
      ? pickVariantGame(variant)
      : pickPuzzle(difficulty as Parameters<typeof pickPuzzle>[0]);
    await db.batch([
      db
        .prepare(
          "INSERT INTO private_rooms (id,code,host_id,difficulty,variant,puzzle,solution,cages,max_players,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          code,
          user.userId,
          isVariantId(variant) ? variantInfo[variant].label : difficulty,
          variant,
          typeof game.puzzle === "string" ? game.puzzle : game.puzzle.join(""),
          typeof game.solution === "string" ? game.solution : game.solution.join(""),
          JSON.stringify("cages" in game ? game.cages : []),
          maxPlayers,
          Date.now(),
        ),
      db
        .prepare("INSERT INTO private_room_players (room_id,user_id) VALUES (?,?)")
        .bind(id, user.userId),
    ]);
    return snapshot(db, id, user.userId);
  }
  if (b.action === "join") {
    if (typeof b.code !== "string" || !/^[A-F0-9]{6}$/.test(b.code)) return fail("Code invalide.");
    const room = await db
      .prepare("SELECT id FROM private_rooms WHERE code=? AND created_at>?")
      .bind(b.code, expiry())
      .first<{ id: string }>();
    if (!room) return fail("Salon introuvable ou expiré.", 404);
    await db
      .prepare(
        "INSERT OR IGNORE INTO private_room_players (room_id,user_id) SELECT id,? FROM private_rooms WHERE id=? AND started_at IS NULL AND (SELECT COUNT(*) FROM private_room_players WHERE room_id=private_rooms.id)<max_players",
      )
      .bind(user.userId, room.id)
      .run();
    const result = await snapshot(db, room.id, user.userId);
    return result.status === 404
      ? fail("Ce salon est complet ou la course a déjà commencé.", 409)
      : result;
  }
  if (typeof b.id !== "string") return fail("Salon invalide.");
  const id = b.id;
  const room = await db
    .prepare(
      "SELECT r.* FROM private_rooms r JOIN private_room_players p ON p.room_id=r.id WHERE r.id=? AND p.user_id=? AND r.created_at>?",
    )
    .bind(id, user.userId, expiry())
    .first<Room>();
  if (!room) return fail("Salon introuvable ou expiré.", 404);
  if (b.action === "ready" && typeof b.ready === "boolean") {
    await db
      .prepare(
        "UPDATE private_room_players SET is_ready=? WHERE room_id=? AND user_id=? AND EXISTS (SELECT 1 FROM private_rooms WHERE id=? AND started_at IS NULL)",
      )
      .bind(Number(b.ready), id, user.userId, id)
      .run();
  } else if (b.action === "start") {
    if (room.host_id !== user.userId) return fail("Seul l’hôte peut lancer la course.", 403);
    const result = await db
      .prepare(
        "UPDATE private_rooms SET started_at=? WHERE id=? AND started_at IS NULL AND (SELECT COUNT(*) FROM private_room_players WHERE room_id=?)>=2 AND NOT EXISTS (SELECT 1 FROM private_room_players WHERE room_id=? AND is_ready=0)",
      )
      .bind(Date.now(), id, id, id)
      .run();
    if (!result.meta.changes)
      return fail("Il faut au moins deux joueurs et tout le monde doit être prêt.", 409);
  } else if (
    b.action === "check" &&
    room.started_at &&
    !room.winner_id &&
    typeof b.index === "number" &&
    Number.isInteger(b.index) &&
    room.puzzle[b.index] === "0" &&
    typeof b.number === "number" &&
    Number.isInteger(b.number) &&
    b.number >= 1 &&
    b.number <= 9
  ) {
    return json({ correct: Number(room.solution[b.index]) === b.number });
  } else if (
    b.action === "progress" &&
    room.started_at &&
    !room.winner_id &&
    Array.isArray(b.grid) &&
    b.grid.length === room.solution.length
  ) {
    const progress = b.grid.filter(
      (digit, index) => room.puzzle[index] === "0" && digit === Number(room.solution[index]),
    ).length;
    await db
      .prepare(
        "UPDATE private_room_players SET progress=MAX(progress,?) WHERE room_id=? AND user_id=?",
      )
      .bind(progress, id, user.userId)
      .run();
    return json({ ok: true });
  } else if (
    b.action === "complete" &&
    room.started_at &&
    !room.winner_id &&
    b.grid === room.solution
  ) {
    await db.batch([
      db
        .prepare("UPDATE private_rooms SET winner_id=? WHERE id=? AND winner_id IS NULL")
        .bind(user.userId, id),
      db
        .prepare(
          "UPDATE private_room_players SET progress=? WHERE room_id=? AND user_id=? AND EXISTS (SELECT 1 FROM private_rooms WHERE id=? AND winner_id=?)",
        )
        .bind(room.puzzle.split("0").length - 1, id, user.userId, id, user.userId),
    ]);
  } else return fail("Action impossible pour cette partie.", 409);
  return snapshot(db, id, user.userId);
}
