"use client";
import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { formatClock } from "@/app/lib/format-time";
import type { BoardSnapshot } from "@/app/lib/solo-save";
import { soloDifficulties, type Difficulty } from "@/lib/difficulties";
import {
  delays,
  entryFee,
  hostFee,
  tournamentCapacity,
  tournamentMinimum,
} from "@/lib/tournament-rules";
import { ConfirmDialog } from "./confirm-dialog";
import { SudokuBoard } from "./sudoku-board";
import "../tournaments.css";

type Tournament = {
  id: string;
  difficulty: string;
  starts_at: number;
  ends_at: number;
  phase: "open" | "playing" | "closing" | "finished" | "cancelled";
  size: number;
  pot: number;
};
type Detail = {
  now: number;
  tournament: Tournament;
  puzzle: string | null;
  entry: { finished: boolean; mistakes: number; payout: number } | null;
  ranking: {
    place: number;
    name: string;
    seconds: number;
    mistakes: number;
    payout: number;
    self: boolean;
  }[];
  estimates: number[];
};
const phaseLabel = {
  open: "Inscriptions ouvertes",
  playing: "Tournoi en cours",
  closing: "Calcul des résultats",
  finished: "Tournoi terminé",
  cancelled: "Tournoi annulé",
};
const remaining = (target: number, now: number) =>
  formatClock(Math.max(0, Math.ceil((target - now) / 1000)));
async function api<T>(
  id?: string,
  body?: Record<string, unknown>,
  authenticated = true,
): Promise<T> {
  const headers = authenticated ? await authHeaders() : {};
  const response = await fetch(
    id ? `/api/tournaments?id=${encodeURIComponent(id)}` : "/api/tournaments",
    body
      ? {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { headers, cache: "no-store" },
  );
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Tournois indisponibles.");
  return data;
}

export function useTournaments() {
  const [list, setList] = useState<Tournament[] | null>(null),
    [error, setError] = useState(false),
    [offset, setOffset] = useState(0),
    [clock, setClock] = useState(0),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let live = true,
      pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await api<{ now: number; tournaments: Tournament[] }>(
          undefined,
          undefined,
          false,
        );
        if (live) {
          setList(data.tournaments);
          setOffset(data.now - Date.now());
          setError(false);
        }
      } catch {
        if (live) setError(true);
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 8000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [revision]);
  return { list, error, now: clock + offset, refresh: () => setRevision((n) => n + 1) };
}

export function TournamentBanner({
  feed,
  onOpen,
}: {
  feed: ReturnType<typeof useTournaments>;
  onOpen: (id?: string) => void;
}) {
  const active = feed.list?.filter((t) => t.phase === "open" || t.phase === "playing") ?? [];
  const [paused, setPaused] = useState(false);
  const featured = active.find((t) => t.phase === "playing") ?? active[0];
  return (
    <aside className="tournament-banner" aria-label="Tournois publics">
      <Trophy aria-hidden="true" />
      <div className="tournament-banner-track">
        {featured ? (
          <span
            className="tournament-moving"
            style={{ animationPlayState: paused ? "paused" : "running" }}
          >
            {featured.phase === "open"
              ? `${featured.difficulty} · départ dans ${remaining(featured.starts_at, feed.now)} · ${tournamentCapacity - featured.size} places restantes`
              : `Tournoi en cours · ${featured.difficulty}`}
          </span>
        ) : (
          <span>
            {feed.error
              ? "Tournois indisponibles"
              : feed.list
                ? "Pas de tournois en cours"
                : "Chargement des tournois…"}
          </span>
        )}
      </div>
      {featured && (
        <button type="button" className="tournament-pause" onClick={() => setPaused((p) => !p)}>
          {paused ? "Reprendre le défilement" : "Pause"}
        </button>
      )}
      <button type="button" className="tournament-link" onClick={() => onOpen(featured?.id)}>
        {featured
          ? featured.phase === "playing"
            ? "Voir le classement"
            : "Voir le tournoi"
          : "Tournois"}
      </button>
    </aside>
  );
}

function TournamentGame({
  detail,
  userId,
  refresh,
}: {
  detail: Detail;
  userId: string;
  refresh: () => void;
}) {
  const id = detail.tournament.id,
    key = `sudoklash:tournament:${userId}:${id}`;
  const [resume] = useState<BoardSnapshot | undefined>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined;
    } catch {
      return undefined;
    }
  });
  const puzzle = useMemo(() => detail.puzzle!.split("").map(Number), [detail.puzzle]);
  const seconds = Math.max(0, Math.floor((detail.now - detail.tournament.starts_at) / 1000));
  const [retry, setRetry] = useState<number[] | null>(null),
    [error, setError] = useState("");
  const submit = async (grid: number[]) => {
    try {
      await api(undefined, { action: "complete", id, grid });
      setRetry(null);
      setError("");
      refresh();
    } catch (e) {
      setRetry(grid);
      setError(e instanceof Error ? e.message : "Résultat indisponible.");
    }
  };
  return (
    <>
      <SudokuBoard
        puzzle={puzzle}
        difficulty={detail.tournament.difficulty}
        title="Grille du tournoi"
        modeLabel="TOURNOI PUBLIC"
        competitive
        hintsAllowed={0}
        initialSeconds={seconds}
        initialMistakes={detail.entry?.mistakes}
        resume={
          resume
            ? { ...resume, seconds, mistakes: detail.entry?.mistakes ?? resume.mistakes }
            : undefined
        }
        judge={{
          check: (entry) =>
            api(undefined, {
              action: "check",
              id,
              index: entry.index,
              number: entry.number,
              entryId: entry.id,
            }),
        }}
        onSnapshot={(snapshot) => {
          try {
            if (snapshot) localStorage.setItem(key, JSON.stringify(snapshot));
            else localStorage.removeItem(key);
          } catch {}
        }}
        onSolved={submit}
      />
      {retry && (
        <div className="panel tournament-card" role="status">
          <p>{error}</p>
          <button className="primary" onClick={() => void submit(retry)}>
            Réessayer de valider le résultat
          </button>
        </div>
      )}
    </>
  );
}

function TournamentSummary({
  current,
  now,
  busy,
  onJoin,
}: Readonly<{
  current: Detail;
  now: number;
  busy: boolean;
  onJoin: () => void;
}>) {
  const status = current.tournament.phase;
  return (
    <section className="panel tournament-card">
      <span className="eyebrow">{phaseLabel[current.tournament.phase]}</span>
      <h3>{current.tournament.difficulty}</h3>
      <p>
        {current.tournament.size}/{tournamentCapacity} joueurs · {current.tournament.pot} Sudokoins
        en jeu
      </p>
      {status === "open" && (
        <p>
          Départ dans <strong>{remaining(current.tournament.starts_at, now)}</strong> · minimum{" "}
          {tournamentMinimum} joueurs · 30 min pour terminer
        </p>
      )}
      {status === "playing" && (
        <p>
          Fin dans <strong>{remaining(current.tournament.ends_at, now)}</strong>
        </p>
      )}
      {status === "open" &&
        (current.entry ? (
          <p>Tu es inscrit. La grille s’ouvrira ici au départ.</p>
        ) : (
          <button
            className="primary"
            disabled={busy || current.tournament.size >= tournamentCapacity}
            onClick={onJoin}
          >
            Rejoindre · {entryFee} Sudokoins
          </button>
        ))}
      {status === "playing" && !current.entry && <p>Les inscriptions sont fermées.</p>}
      {status === "cancelled" && (
        <p>
          Pas assez de participants ou aucune grille validée.{" "}
          {current.entry
            ? `Mise remboursée : ${current.entry.payout} Sudokoins.`
            : "Les mises ont été remboursées."}
        </p>
      )}
      {status === "finished" && current.entry && (
        <p>
          Ton gain : <strong>{current.entry.payout} Sudokoins</strong>.
        </p>
      )}
      {current.entry?.finished && status === "playing" && (
        <p>Grille validée ! Les gains seront distribués à la clôture.</p>
      )}
      {(current.entry?.mistakes ?? 0) >= 3 && <p>Tentative terminée : trois erreurs.</p>}
      {status === "open" && (
        <details>
          <summary>Gains estimés par place</summary>
          <p>
            Estimation avec les inscriptions actuelles. Les gains définitifs dépendent du nombre de
            grilles validées.
          </p>
          <ol>
            {current.estimates
              .map((amount, index) => ({ amount, place: index + 1 }))
              .map(({ amount, place }) => (
                <li key={place}>{amount} Sudokoins</li>
              ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function TournamentRanking({ current }: Readonly<{ current: Detail }>) {
  const status = current.tournament.phase;
  return (
    <section className="panel tournament-card">
      <h3>Classement</h3>
      {current.ranking.length ? (
        <ol className="tournament-ranking">
          {current.ranking.map((row) => (
            <li key={row.place}>
              <b>
                {row.place}. {row.name}
                {row.self ? " (toi)" : ""}
              </b>
              <span>
                {row.seconds.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} s ·{" "}
                {row.mistakes} erreur{row.mistakes === 1 ? "" : "s"}
                {status === "finished" ? ` · ${row.payout} Sudokoins` : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p>Aucun résultat validé.</p>
      )}
    </section>
  );
}

function TournamentList({
  feed,
  onOpen,
}: Readonly<{
  feed: ReturnType<typeof useTournaments>;
  onOpen: (id?: string) => void;
}>) {
  if (feed.error) return <button onClick={feed.refresh}>Réessayer de charger les tournois</button>;
  if (!feed.list) return <p>Chargement…</p>;
  if (!feed.list.length) return <p>Pas de tournois en cours</p>;
  return (
    <ul className="tournament-list">
      {feed.list.map((t) => (
        <li key={t.id}>
          <div>
            <b>
              {t.difficulty} · {phaseLabel[t.phase]}
            </b>
            <p>
              {t.phase === "open" ? `Départ dans ${remaining(t.starts_at, feed.now)} · ` : ""}
              {t.size}/{tournamentCapacity} joueurs · {t.pot} Sudokoins
            </p>
          </div>
          <button className="tournament-link" onClick={() => onOpen(t.id)}>
            Voir le tournoi
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Tournaments({
  feed,
  id,
  onOpen,
  userId,
  coins,
  openAuth,
  walletRefresh,
}: {
  feed: ReturnType<typeof useTournaments>;
  id: string | null;
  onOpen: (id?: string) => void;
  userId?: string;
  coins?: number;
  openAuth: () => void;
  walletRefresh: () => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermédiaire"),
    [delay, setDelay] = useState(10),
    [confirmation, setConfirmation] = useState<"create" | "join" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!id) return;
    let live = true,
      pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await api<Detail>(id, undefined, !!userId);
        if (live) {
          setDetail(data);
          setError("");
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Tournoi indisponible.");
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id, userId, revision]);
  const current = detail?.tournament.id === id ? detail : null;
  const status = current?.tournament.phase;
  const entryExists = !!current?.entry;
  useEffect(() => {
    if (entryExists && (status === "finished" || status === "cancelled")) walletRefresh();
  }, [id, status, entryExists]);
  const confirm = (action: "create" | "join") => {
    if (!userId) {
      openAuth();
      return;
    }
    setConfirmation(action);
  };
  const send = async () => {
    if (!confirmation || busy) return;
    const action = confirmation;
    setBusy(true);
    setConfirmation(null);
    setError("");
    try {
      const result = await api<{ id: string }>(
        undefined,
        action === "create" ? { action, difficulty, delay } : { action, id },
      );
      onOpen(result.id);
      setRevision((n) => n + 1);
      feed.refresh();
      walletRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demande indisponible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="tournament-section">
      <header className="panel tournament-card">
        <h2>Tournois publics</h2>
        <p>
          Une grille Classique 9×9 pour tous. Une tentative, trois erreurs maximum, aucun indice.
          Les 25 meilleurs joueurs qui terminent reçoivent au moins 25 Sudokoins.
        </p>
        {coins !== undefined && (
          <p>
            Ton solde : <strong>{coins} Sudokoins</strong>
          </p>
        )}
      </header>
      {error && <p role="alert">{error}</p>}
      {id ? (
        <>
          <button
            type="button"
            className="tournament-link"
            onClick={() => {
              setError("");
              onOpen();
            }}
          >
            ← Tous les tournois
          </button>
          {!current ? (
            <p role="status">{error ? "Tournoi indisponible." : "Chargement du tournoi…"}</p>
          ) : (
            <>
              <TournamentSummary
                current={current}
                now={feed.now}
                busy={busy}
                onJoin={() => confirm("join")}
              />
              {current.puzzle && userId && (
                <TournamentGame
                  key={`${userId}:${id}`}
                  detail={current}
                  userId={userId}
                  refresh={() => setRevision((n) => n + 1)}
                />
              )}
              {status !== "open" && status !== "cancelled" && (
                <TournamentRanking current={current} />
              )}
            </>
          )}
        </>
      ) : (
        <>
          <section className="panel tournament-card">
            <h3>Créer un tournoi</h3>
            <p>
              La création coûte {hostFee} Sudokoins et comprend ta place. Ta mise rejoint la
              cagnotte.
            </p>
            <div className="tournament-fields">
              <label>
                Difficulté{" "}
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                >
                  {soloDifficulties.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                Départ dans{" "}
                <select value={delay} onChange={(e) => setDelay(Number(e.target.value))}>
                  {delays.map((n) => (
                    <option key={n} value={n}>
                      {n} minutes
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => confirm("create")}
              >
                Créer · {hostFee} Sudokoins
              </button>
            </div>
          </section>
          <section className="panel tournament-card">
            <h3>Tournois et résultats récents</h3>
            <TournamentList feed={feed} onOpen={onOpen} />
          </section>
        </>
      )}
      {confirmation && (
        <ConfirmDialog
          title={confirmation === "create" ? "Créer ce tournoi ?" : "Rejoindre ce tournoi ?"}
          message={`${confirmation === "create" ? hostFee : entryFee} Sudokoins seront ajoutés à la cagnotte. Ta mise est remboursée si le tournoi est annulé.`}
          confirmLabel="Confirmer"
          onConfirm={() => void send()}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </div>
  );
}
