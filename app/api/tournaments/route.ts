import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import { isSoloDifficulty } from "@/lib/difficulties";
import { pickPuzzle } from "@/lib/puzzle-picker";
import { counts } from "@/lib/player-counts";
import { progressFor } from "@/lib/cosmetics";
import {
  isCellIndex,
  isDigit,
  isEntryId,
  matchesSolution,
  mistakeKey,
} from "@/lib/entry-validation";
import { MIN_COMPLETE_SECONDS } from "@/lib/solo-rules";
import {
  delays,
  entryFee,
  hostFee,
  tournamentCapacity,
  tournamentDuration,
  tournamentMinimum,
  tournamentPrizes,
} from "@/lib/tournament-rules";
import type { LiveTournament } from "@/lib/tournament-spectator";
import { settleTournaments, tournamentNetSQL } from "@/lib/tournament-wallet";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error: string, status = 400) => json({ error }, status);
const emptyProgress = "0".repeat(81);
const balance = `? + ${tournamentNetSQL} - (SELECT COALESCE(SUM(price),0) FROM cosmetic_purchases WHERE user_id=?)`;
type Tournament = {
  id: string;
  difficulty: string;
  starts_at: number;
  ends_at: number;
  settled: string | null;
  puzzle: string;
  solution: string;
  size: number;
  pot: number;
};
type Entry = {
  user_id: string;
  username: string | null;
  finished_at: number | null;
  mistakes: number;
  payout: number;
};
const byId = (db: D1Database, id: string) =>
  db.prepare("SELECT * FROM tournaments WHERE id=?").bind(id).first<Tournament>();
const mine = (db: D1Database, id: string, user: string) =>
  db
    .prepare("SELECT * FROM tournament_entries WHERE tournament_id=? AND user_id=?")
    .bind(id, user)
    .first<Entry>();
const phase = (t: Tournament, now: number) => {
  if (t.settled != null) return t.settled;
  if (now < t.starts_at) return "open";
  return now < t.ends_at ? "playing" : "closing";
};

async function spectate(db: D1Database, request: Request, id: string | null) {
  const user = await getSiteUser(request);
  if (!user) return fail("Connecte-toi pour regarder le tournoi.", 401);
  if (!id) return fail("Tournoi invalide.");
  const [t, entry] = await Promise.all([byId(db, id), mine(db, id, user.userId)]);
  if (!t) return fail("Tournoi introuvable.", 404);
  // All entrants stay ineligible, even after finishing or being eliminated.
  if (entry)
    return fail("Le mode spectateur est réservé aux joueurs non inscrits à ce tournoi.", 403);
  if (phase(t, Date.now()) !== "playing") return json({ live: false } satisfies LiveTournament);
  const total = t.puzzle.split("0").length - 1;
  const { results } = await db
    .prepare(
      `SELECT p.username,e.finished_at,e.mistakes,e.correct_cells,
        CASE WHEN e.finished_at IS NOT NULL THEN ?
             ELSE LENGTH(REPLACE(COALESCE(e.correct_cells,''),'0','')) END AS correct
      FROM tournament_entries e LEFT JOIN player_profiles p ON p.user_id=e.user_id
      WHERE e.tournament_id=?
      ORDER BY correct DESC,e.finished_at IS NULL,e.finished_at,e.mistakes,
               e.correct_updated_at,e.joined_at,e.user_id`,
    )
    .bind(total, id)
    .all<{
      username: string | null;
      finished_at: number | null;
      mistakes: number;
      correct_cells: string | null;
      correct: number;
    }>();
  if (results.length < tournamentMinimum || Date.now() >= t.ends_at)
    return json({ live: false } satisfies LiveTournament);
  const leader = results[0];
  return json({
    live: true,
    total,
    ranking: results.map((player, i) => ({
      place: i + 1,
      name: player.username ?? `Joueur ${i + 1}`,
      correct: player.correct,
      status:
        player.finished_at !== null ? "finished" : player.mistakes >= 3 ? "eliminated" : "playing",
    })),
    leader: leader
      ? {
          givens: t.puzzle,
          grid:
            leader.finished_at !== null
              ? t.solution
              : Array.from(t.puzzle, (cell, i) =>
                  leader.correct_cells?.[i] === "1" ? t.solution[i] : cell,
                ).join(""),
        }
      : null,
  } satisfies LiveTournament);
}

export async function GET(request: Request) {
  const db = env.DB;
  if (!db) return fail("Tournois indisponibles.", 503);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (searchParams.get("spectate") === "1") return spectate(db, request, id);
  const now = Date.now();
  await settleTournaments(db, now);
  if (!id) {
    const rows = (
      await db
        .prepare(
          `SELECT t.id,t.difficulty,t.starts_at,t.ends_at,t.settled,COUNT(e.user_id) AS size,COALESCE(SUM(e.fee),0) AS pot
      FROM tournaments t LEFT JOIN tournament_entries e ON e.tournament_id=t.id
      WHERE t.starts_at>? GROUP BY t.id ORDER BY t.settled IS NOT NULL,t.starts_at LIMIT 50`,
        )
        .bind(now - 86400000)
        .all<Tournament>()
    ).results;
    return json({ now, tournaments: rows.map((t) => ({ ...t, phase: phase(t, now) })) });
  }
  const t = await byId(db, id);
  if (!t) return fail("Tournoi introuvable.", 404);
  const user = await getSiteUser(request);
  const entry = user ? await mine(db, id, user.userId) : null;
  const players = (
    await db
      .prepare(
        `SELECT e.user_id,e.finished_at,e.mistakes,e.payout,p.username
    FROM tournament_entries e LEFT JOIN player_profiles p ON p.user_id=e.user_id WHERE e.tournament_id=?
    ORDER BY e.finished_at IS NULL,e.finished_at,e.mistakes,e.joined_at,e.user_id`,
      )
      .bind(id)
      .all<Entry>()
  ).results;
  const status = phase(t, now);
  return json({
    now,
    tournament: {
      id: t.id,
      difficulty: t.difficulty,
      starts_at: t.starts_at,
      ends_at: t.ends_at,
      phase: status,
      size: players.length,
      pot: players.length ? hostFee + entryFee * (players.length - 1) : 0,
    },
    entry: entry
      ? { finished: entry.finished_at !== null, mistakes: entry.mistakes, payout: entry.payout }
      : null,
    puzzle:
      entry &&
      status === "playing" &&
      players.length >= tournamentMinimum &&
      entry.finished_at === null &&
      entry.mistakes < 3
        ? t.puzzle
        : null,
    ranking: players
      .filter((p) => p.finished_at !== null)
      .map((p, i) => ({
        place: i + 1,
        name: p.username ?? "Joueur",
        seconds: (p.finished_at! - t.starts_at) / 1000,
        mistakes: p.mistakes,
        payout: p.payout,
        self: p.user_id === user?.userId,
      })),
    estimates: tournamentPrizes(
      players.length ? hostFee + entryFee * (players.length - 1) : 0,
      players.length,
    ),
  });
}

type Body = Record<string, unknown>;

const ACTIVE_SQL =
  "EXISTS (SELECT 1 FROM tournaments t WHERE t.id=? AND t.starts_at<=? AND t.ends_at>? AND t.settled IS NULL AND (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id=t.id)>=?)";

async function createTournament(db: D1Database, uid: string, b: Body, now: number, earned: number) {
  const difficulty = b.difficulty,
    delay = b.delay;
  if (!isSoloDifficulty(difficulty) || !(delays as readonly unknown[]).includes(delay))
    return fail("Réglages invalides.");
  const id = crypto.randomUUID(),
    start = Date.now() + Number(delay) * 60000,
    game = pickPuzzle(difficulty);
  const [created] = await db.batch([
    db
      .prepare(
        `INSERT INTO tournaments (id,host_id,difficulty,starts_at,ends_at,puzzle,solution)
          SELECT ?,?,?,?,?,?,? WHERE ${balance}>=? AND NOT EXISTS(SELECT 1 FROM tournaments WHERE host_id=? AND settled IS NULL AND ends_at>?)`,
      )
      .bind(
        id,
        uid,
        difficulty,
        start,
        start + tournamentDuration,
        game.puzzle,
        game.solution,
        earned,
        uid,
        uid,
        hostFee,
        uid,
        now,
      ),
    db
      .prepare(
        "INSERT INTO tournament_entries (tournament_id,user_id,joined_at,fee) SELECT id,?,?,? FROM tournaments WHERE id=?",
      )
      .bind(uid, now, hostFee, id),
  ]);
  return created.meta.changes
    ? json({ id })
    : fail("Il faut 50 Sudokoins et aucun autre tournoi ouvert à ton nom.", 409);
}

async function joinTournament(
  db: D1Database,
  uid: string,
  id: unknown,
  now: number,
  earned: number,
) {
  if (typeof id !== "string") return fail("Tournoi invalide.");
  if (await mine(db, id, uid)) return json({ id });
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO tournament_entries (tournament_id,user_id,joined_at,fee)
      SELECT id,?,?,? FROM tournaments t WHERE id=? AND starts_at>? AND settled IS NULL
      AND (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id=t.id)<? AND ${balance}>=?`,
    )
    .bind(uid, now, entryFee, id, Date.now(), tournamentCapacity, earned, uid, uid, entryFee)
    .run();
  if (!result.meta.changes && !(await mine(db, id, uid)))
    return fail("Inscription fermée, tournoi complet ou solde inférieur à 25 Sudokoins.", 409);
  return json({ id });
}

async function checkCell(db: D1Database, uid: string, t: Tournament, e: Entry, b: Body) {
  const { index, number, entryId } = b;
  if (!isCellIndex(index) || !isDigit(number) || !isEntryId(entryId) || t.puzzle[index] !== "0")
    return fail("Case invalide.");
  const correct = Number(t.solution[index]) === number;
  if (correct) {
    const at = Date.now();
    // Merge each validated move atomically. A retry cannot add a second point or change a tie.
    await db
      .prepare(
        `UPDATE tournament_entries
       SET correct_cells=substr(COALESCE(correct_cells,?),1,?) || '1' || substr(COALESCE(correct_cells,?),?),
           correct_updated_at=?
       WHERE tournament_id=? AND user_id=? AND mistakes<3 AND finished_at IS NULL
       AND substr(COALESCE(correct_cells,?),?,1)='0' AND ${ACTIVE_SQL}`,
      )
      .bind(
        emptyProgress,
        index,
        emptyProgress,
        index + 2,
        at,
        t.id,
        uid,
        emptyProgress,
        index + 1,
        t.id,
        at,
        at,
        tournamentMinimum,
      )
      .run();
  } else {
    const key = mistakeKey(entryId, index, number),
      at = Date.now();
    await db
      .prepare(
        `UPDATE tournament_entries SET mistakes=mistakes+1,last_mistake=? WHERE tournament_id=? AND user_id=? AND mistakes<3 AND finished_at IS NULL AND last_mistake IS NOT ? AND ${ACTIVE_SQL}`,
      )
      .bind(key, t.id, uid, key, t.id, at, at, tournamentMinimum)
      .run();
  }
  return json({ correct, mistakes: (await mine(db, t.id, uid))?.mistakes ?? e.mistakes });
}

async function completeEntry(
  db: D1Database,
  uid: string,
  t: Tournament,
  grid: unknown,
  now: number,
) {
  if (!matchesSolution(t.solution, grid) || now - t.starts_at < MIN_COMPLETE_SECONDS * 1000)
    return fail("Grille ou temps invalide.", 409);
  const at = Date.now();
  const result = await db
    .prepare(
      `UPDATE tournament_entries SET finished_at=? WHERE tournament_id=? AND user_id=? AND finished_at IS NULL AND mistakes<3 AND ${ACTIVE_SQL}`,
    )
    .bind(at, t.id, uid, t.id, at, at, tournamentMinimum)
    .run();
  return result.meta.changes
    ? json({ finished: true })
    : fail("La tentative ne peut plus être validée.", 409);
}

const attemptOpen = (t: Tournament, e: Entry, now: number) =>
  !t.settled && now >= t.starts_at && now < t.ends_at && e.finished_at === null && e.mistakes < 3;

/** A move in a tournament the player has joined. */
async function playTournament(db: D1Database, uid: string, b: Body, now: number) {
  if (typeof b.id !== "string") return fail("Tournoi invalide.");
  const id = b.id;
  const [t, e] = await Promise.all([byId(db, id), mine(db, id, uid)]);
  if (!t || !e) return fail("Tu ne participes pas à ce tournoi.", 403);
  if (b.action === "complete" && e.finished_at !== null) return json({ finished: true });
  if (!attemptOpen(t, e, now)) return fail("Ta tentative est indisponible ou terminée.", 409);
  const n = await db
    .prepare("SELECT COUNT(*) AS n FROM tournament_entries WHERE tournament_id=?")
    .bind(id)
    .first<{ n: number }>();
  if (!n || n.n < tournamentMinimum) return fail("Tournoi annulé : pas assez de joueurs.", 409);
  if (b.action === "check") return checkCell(db, uid, t, e, b);
  if (b.action === "complete") return completeEntry(db, uid, t, b.grid, now);
  return fail("Action inconnue.");
}

export async function POST(request: Request) {
  const user = await getSiteUser(request),
    db = env.DB;
  if (!user) return fail("Connecte-toi pour participer.", 401);
  if (!db) return fail("Tournois indisponibles.", 503);
  const b = (await request.json().catch(() => null)) as Body | null;
  if (!b) return fail("Demande invalide.");
  const now = Date.now(),
    uid = user.userId;
  if (b.action !== "create" && b.action !== "join") return playTournament(db, uid, b, now);
  await settleTournaments(db, now, uid);
  const earned = progressFor(await counts(db, uid)).earnedCoins;
  return b.action === "create"
    ? createTournament(db, uid, b, now, earned)
    : joinTournament(db, uid, b.id, now, earned);
}
