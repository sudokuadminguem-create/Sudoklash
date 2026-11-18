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
import { settleTournaments, tournamentNetSQL } from "@/lib/tournament-wallet";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error: string, status = 400) => json({ error }, status);
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
const phase = (t: Tournament, now: number) =>
  t.settled ?? (now < t.starts_at ? "open" : now < t.ends_at ? "playing" : "closing");

export async function GET(request: Request) {
  const db = env.DB;
  if (!db) return fail("Tournois indisponibles.", 503);
  const now = Date.now(),
    id = new URL(request.url).searchParams.get("id");
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

export async function POST(request: Request) {
  const user = await getSiteUser(request),
    db = env.DB;
  if (!user) return fail("Connecte-toi pour participer.", 401);
  if (!db) return fail("Tournois indisponibles.", 503);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return fail("Demande invalide.");
  const now = Date.now(),
    uid = user.userId;
  if (b.action === "create" || b.action === "join") {
    await settleTournaments(db, now, uid);
    const earned = progressFor(await counts(db, uid)).earnedCoins;
    if (b.action === "create") {
      const difficulty = b.difficulty,
        delay = b.delay;
      if (!isSoloDifficulty(difficulty) || !delays.some((d) => d === delay))
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
    if (typeof b.id !== "string") return fail("Tournoi invalide.");
    if (await mine(db, b.id, uid)) return json({ id: b.id });
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO tournament_entries (tournament_id,user_id,joined_at,fee)
      SELECT id,?,?,? FROM tournaments t WHERE id=? AND starts_at>? AND settled IS NULL
      AND (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id=t.id)<? AND ${balance}>=?`,
      )
      .bind(uid, now, entryFee, b.id, Date.now(), tournamentCapacity, earned, uid, uid, entryFee)
      .run();
    if (!result.meta.changes && !(await mine(db, b.id, uid)))
      return fail("Inscription fermée, tournoi complet ou solde inférieur à 25 Sudokoins.", 409);
    return json({ id: b.id });
  }
  if (typeof b.id !== "string") return fail("Tournoi invalide.");
  const id = b.id;
  const [t, e] = await Promise.all([byId(db, id), mine(db, id, uid)]);
  if (!t || !e) return fail("Tu ne participes pas à ce tournoi.", 403);
  if (b.action === "complete" && e.finished_at !== null) return json({ finished: true });
  const active =
    "EXISTS (SELECT 1 FROM tournaments t WHERE t.id=? AND t.starts_at<=? AND t.ends_at>? AND t.settled IS NULL AND (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id=t.id)>=?)";
  if (
    t.settled ||
    now < t.starts_at ||
    now >= t.ends_at ||
    e.finished_at !== null ||
    e.mistakes >= 3
  )
    return fail("Ta tentative est indisponible ou terminée.", 409);
  const n = await db
    .prepare("SELECT COUNT(*) AS n FROM tournament_entries WHERE tournament_id=?")
    .bind(id)
    .first<{ n: number }>();
  if (!n || n.n < tournamentMinimum) return fail("Tournoi annulé : pas assez de joueurs.", 409);
  if (b.action === "check") {
    const { index, number, entryId } = b;
    if (!isCellIndex(index) || !isDigit(number) || !isEntryId(entryId) || t.puzzle[index] !== "0")
      return fail("Case invalide.");
    const correct = Number(t.solution[index]) === number;
    if (!correct) {
      const key = mistakeKey(entryId, index, number),
        at = Date.now();
      await db
        .prepare(
          `UPDATE tournament_entries SET mistakes=mistakes+1,last_mistake=? WHERE tournament_id=? AND user_id=? AND mistakes<3 AND finished_at IS NULL AND last_mistake IS NOT ? AND ${active}`,
        )
        .bind(key, id, uid, key, id, at, at, tournamentMinimum)
        .run();
    }
    return json({ correct, mistakes: (await mine(db, id, uid))?.mistakes ?? e.mistakes });
  }
  if (b.action === "complete") {
    if (!matchesSolution(t.solution, b.grid) || now - t.starts_at < MIN_COMPLETE_SECONDS * 1000)
      return fail("Grille ou temps invalide.", 409);
    const at = Date.now();
    const result = await db
      .prepare(
        `UPDATE tournament_entries SET finished_at=? WHERE tournament_id=? AND user_id=? AND finished_at IS NULL AND mistakes<3 AND ${active}`,
      )
      .bind(at, id, uid, id, at, at, tournamentMinimum)
      .run();
    return result.meta.changes
      ? json({ finished: true })
      : fail("La tentative ne peut plus être validée.", 409);
  }
  return fail("Action inconnue.");
}
