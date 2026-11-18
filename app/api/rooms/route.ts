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

type Body = Record<string, unknown>;
/** A room action; a null result answers with the refreshed room. */
type RoomAction = (db: D1Database, room: Room, userId: string, b: Body) => Promise<Response | null>;

const impossible = () => fail("Action impossible pour cette partie.", 409);
const racing = (room: Room) => Boolean(room.started_at && !room.winner_id);
const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

const validSettings = (variant: unknown, difficulty: unknown, maxPlayers: unknown) =>
  isInteger(maxPlayers) &&
  maxPlayers >= 2 &&
  maxPlayers <= 8 &&
  (variant === "classic" ? isSoloDifficulty(difficulty) : isVariantId(variant));

async function createRoom(db: D1Database, userId: string, b: Body) {
  const { difficulty, variant, maxPlayers } = b;
  if (!validSettings(variant, difficulty, maxPlayers)) return fail("Réglages invalides.");
  const id = crypto.randomUUID(),
    code = id.slice(0, 6).toUpperCase();
  const variantId = isVariantId(variant) ? variant : null;
  const game = variantId
    ? pickVariantGame(variantId)
    : pickPuzzle(difficulty as Parameters<typeof pickPuzzle>[0]);
  const digits = (value: string | readonly number[]) =>
    typeof value === "string" ? value : value.join("");
  await db.batch([
    db
      .prepare(
        "INSERT INTO private_rooms (id,code,host_id,difficulty,variant,puzzle,solution,cages,max_players,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        code,
        userId,
        variantId ? variantInfo[variantId].label : difficulty,
        variant,
        digits(game.puzzle),
        digits(game.solution),
        JSON.stringify("cages" in game ? game.cages : []),
        maxPlayers,
        Date.now(),
      ),
    db.prepare("INSERT INTO private_room_players (room_id,user_id) VALUES (?,?)").bind(id, userId),
  ]);
  return snapshot(db, id, userId);
}

async function joinRoom(db: D1Database, userId: string, code: unknown) {
  if (typeof code !== "string" || !/^[A-F0-9]{6}$/.test(code)) return fail("Code invalide.");
  const room = await db
    .prepare("SELECT id FROM private_rooms WHERE code=? AND created_at>?")
    .bind(code, expiry())
    .first<{ id: string }>();
  if (!room) return fail("Salon introuvable ou expiré.", 404);
  await db
    .prepare(
      "INSERT OR IGNORE INTO private_room_players (room_id,user_id) SELECT id,? FROM private_rooms WHERE id=? AND started_at IS NULL AND (SELECT COUNT(*) FROM private_room_players WHERE room_id=private_rooms.id)<max_players",
    )
    .bind(userId, room.id)
    .run();
  const result = await snapshot(db, room.id, userId);
  return result.status === 404
    ? fail("Ce salon est complet ou la course a déjà commencé.", 409)
    : result;
}

const setReady: RoomAction = async (db, room, userId, b) => {
  if (typeof b.ready !== "boolean") return impossible();
  await db
    .prepare(
      "UPDATE private_room_players SET is_ready=? WHERE room_id=? AND user_id=? AND EXISTS (SELECT 1 FROM private_rooms WHERE id=? AND started_at IS NULL)",
    )
    .bind(Number(b.ready), room.id, userId, room.id)
    .run();
  return null;
};

const startRace: RoomAction = async (db, room, userId) => {
  if (room.host_id !== userId) return fail("Seul l’hôte peut lancer la course.", 403);
  const result = await db
    .prepare(
      "UPDATE private_rooms SET started_at=? WHERE id=? AND started_at IS NULL AND (SELECT COUNT(*) FROM private_room_players WHERE room_id=?)>=2 AND NOT EXISTS (SELECT 1 FROM private_room_players WHERE room_id=? AND is_ready=0)",
    )
    .bind(Date.now(), room.id, room.id, room.id)
    .run();
  if (!result.meta.changes)
    return fail("Il faut au moins deux joueurs et tout le monde doit être prêt.", 409);
  return null;
};

const checkDigit: RoomAction = async (_db, room, _userId, b) => {
  const { index, number } = b;
  if (
    !racing(room) ||
    !isInteger(index) ||
    room.puzzle[index] !== "0" ||
    !isInteger(number) ||
    number < 1 ||
    number > 9
  )
    return impossible();
  return json({ correct: Number(room.solution[index]) === number });
};

const recordProgress: RoomAction = async (db, room, userId, b) => {
  const { grid } = b;
  if (!racing(room) || !Array.isArray(grid) || grid.length !== room.solution.length)
    return impossible();
  const progress = grid.filter(
    (digit, index) => room.puzzle[index] === "0" && digit === Number(room.solution[index]),
  ).length;
  await db
    .prepare(
      "UPDATE private_room_players SET progress=MAX(progress,?) WHERE room_id=? AND user_id=?",
    )
    .bind(progress, room.id, userId)
    .run();
  return json({ ok: true });
};

const completeRace: RoomAction = async (db, room, userId, b) => {
  if (!racing(room) || b.grid !== room.solution) return impossible();
  await db.batch([
    db
      .prepare("UPDATE private_rooms SET winner_id=? WHERE id=? AND winner_id IS NULL")
      .bind(userId, room.id),
    db
      .prepare(
        "UPDATE private_room_players SET progress=? WHERE room_id=? AND user_id=? AND EXISTS (SELECT 1 FROM private_rooms WHERE id=? AND winner_id=?)",
      )
      .bind(room.puzzle.split("0").length - 1, room.id, userId, room.id, userId),
  ]);
  return null;
};

const roomActions: Record<string, RoomAction> = {
  ready: setReady,
  start: startRace,
  check: checkDigit,
  progress: recordProgress,
  complete: completeRace,
};

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return fail("Connecte-toi pour jouer.", 401);
  const db = env.DB;
  if (!db) return fail("Salons indisponibles.", 503);
  const b = (await request.json().catch(() => null)) as Body | null;
  if (!b) return fail("Demande invalide.");
  if (b.action === "create") return createRoom(db, user.userId, b);
  if (b.action === "join") return joinRoom(db, user.userId, b.code);
  if (typeof b.id !== "string") return fail("Salon invalide.");
  const id = b.id;
  const room = await db
    .prepare(
      "SELECT r.* FROM private_rooms r JOIN private_room_players p ON p.room_id=r.id WHERE r.id=? AND p.user_id=? AND r.created_at>?",
    )
    .bind(id, user.userId, expiry())
    .first<Room>();
  if (!room) return fail("Salon introuvable ou expiré.", 404);
  const action =
    typeof b.action === "string" && Object.hasOwn(roomActions, b.action)
      ? roomActions[b.action]
      : null;
  if (!action) return impossible();
  return (await action(db, room, user.userId, b)) ?? snapshot(db, id, user.userId);
}
