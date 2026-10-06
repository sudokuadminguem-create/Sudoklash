"use client";
import { useEffect, useState } from "react";
import { Trophy, Play } from "lucide-react";
import { soloDifficulties, type Difficulty } from "@/lib/difficulties";
import { authHeaders } from "@/app/lib/auth-headers";
import { formatDuration } from "@/app/lib/format-time";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { PlayerAvatar } from "./player-cosmetics";
import { TimedChallenge } from "./timed-challenge";
import "../daily-challenges.css";

type Player = {
  position: number;
  userId: string;
  username: string;
  seconds: number;
  mistakes: number;
  avatarId: string;
  frameId: string;
  image: string | null;
};
function DailyRanking({ difficulty, openAuth }: { difficulty: Difficulty; openAuth: () => void }) {
  const [players, setPlayers] = useState<Player[] | null>(null),
    [error, setError] = useState(false),
    [auth, setAuth] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setPlayers(null);
    setError(false);
    setAuth(false);
    const load = async () => {
      try {
        const response = await fetch(
          `/api/daily?difficulty=${encodeURIComponent(difficulty)}&view=leaderboard`,
          { headers: await authHeaders(), cache: "no-store" },
        );
        if (response.status === 401) {
          if (live) setAuth(true);
          return;
        }
        if (!response.ok) throw Error("ranking");
        const data = (await response.json()) as { players: Player[] };
        if (live) setPlayers(data.players);
      } catch {
        if (live) setError(true);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [difficulty, retry]);
  return (
    <section className="panel daily-ranking" aria-label={`Classement quotidien ${difficulty}`}>
      <div className="panel-head">
        <span className="eyebrow">CLASSEMENT DU JOUR</span>
        <h2>{difficulty}</h2>
        <p>Les meilleurs temps sur cette grille. Classement renouvelé à minuit, heure de Paris.</p>
      </div>
      {auth ? (
        <button className="primary" onClick={openAuth}>
          Se connecter pour voir le classement
        </button>
      ) : error ? (
        <div role="status">
          <p>Classement momentanément indisponible.</p>
          <button onClick={() => setRetry((n) => n + 1)}>Réessayer</button>
        </div>
      ) : players === null ? (
        <p role="status">Chargement du classement…</p>
      ) : !players.length ? (
        <p>Aucune grille terminée dans cette difficulté aujourd’hui. Soyez le premier !</p>
      ) : (
        <ol className="daily-ranking-list">
          {players.map((p) => (
            <li key={p.userId}>
              <b className="daily-position">{p.position}</b>
              <PlayerAvatar
                avatarId={p.avatarId}
                frameId={p.frameId}
                image={p.image}
                size="small"
              />
              <span className="daily-player">
                <b>{p.username}</b>
                <small>
                  {p.mistakes} erreur{p.mistakes !== 1 ? "s" : ""}
                </small>
              </span>
              <strong>{formatDuration(p.seconds)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
export function DailyChallenges({
  openAuth,
  cosmetics,
}: {
  openAuth: () => void;
  cosmetics: Cosmetics;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("Facile"),
    [view, setView] = useState<"play" | "ranking">("play");
  return (
    <div className="daily-challenges">
      <section className="panel daily-selection">
        <span className="eyebrow">SIX GRILLES PAR JOUR</span>
        <h2>Défis quotidiens</h2>
        <p>Une grille commune à tous par difficulté. Une tentative sur chacun des six niveaux.</p>
        <div className="daily-levels" aria-label="Difficulté quotidienne">
          {soloDifficulties.map((d) => (
            <button
              key={d}
              aria-pressed={difficulty === d}
              className={difficulty === d ? "active" : ""}
              onClick={() => setDifficulty(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="daily-views">
          <button
            aria-pressed={view === "play"}
            className={view === "play" ? "active" : ""}
            onClick={() => setView("play")}
          >
            <Play aria-hidden="true" />
            Jouer · {difficulty}
          </button>
          <button
            aria-pressed={view === "ranking"}
            className={view === "ranking" ? "active" : ""}
            onClick={() => setView("ranking")}
          >
            <Trophy aria-hidden="true" />
            Classement · {difficulty}
          </button>
        </div>
      </section>
      {view === "play" ? (
        <TimedChallenge
          key={difficulty}
          kind="daily"
          difficulty={difficulty}
          openAuth={openAuth}
          cosmetics={cosmetics}
        />
      ) : (
        <DailyRanking key={difficulty} difficulty={difficulty} openAuth={openAuth} />
      )}
    </div>
  );
}
