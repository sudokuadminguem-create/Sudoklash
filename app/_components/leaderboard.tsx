"use client";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { PlayerAvatar } from "./player-cosmetics";

export function Leaderboard() {
  type Row = {
    position: number;
    username: string;
    points: number;
    wins: number;
    losses: number;
    rank: { label: string };
    avatarId: string;
    frameId: string;
    image: string | null;
  };
  const [players, setPlayers] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/ranked?leaderboard=1", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("classement");
        return r.json() as Promise<{ players: Row[] }>;
      })
      .then((data) => {
        if (live) setPlayers(data.players);
      })
      .catch(() => {
        if (live) setError(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="eyebrow">PARTIES CLASSÉES</span>
        <h2>Classement Sudoku Clash</h2>
        <p className="panel-copy">
          Les 100 meilleurs joueurs par points. Le rang Maître exige au moins 1 700 points et une
          place dans ce top 100.
        </p>
      </div>
      {loading ? (
        <p>Chargement du classement…</p>
      ) : error ? (
        <p>Classement momentanément indisponible.</p>
      ) : players.length ? (
        <>
          <div className="podium">
            {players.slice(0, 3).map((r, i) => (
              <div className={`pod p${i + 1}`} key={r.position}>
                <div className="pod-avatar">
                  <PlayerAvatar avatarId={r.avatarId} image={r.image} frameId={r.frameId} />
                  {i === 0 && <Crown className="pod-crown" aria-hidden="true" />}
                </div>
                <b>{r.username}</b>
                <span>{r.rank.label}</span>
                <strong>{r.points} points</strong>
              </div>
            ))}
          </div>
          <div className="rank-table">
            <div className="tr head">
              <span>Place</span>
              <span>Joueur</span>
              <span>Rang</span>
              <span>Points</span>
              <span>Victoires</span>
            </div>
            {players.map((r) => (
              <div className="tr" key={r.position}>
                <b>#{r.position}</b>
                <span>
                  <PlayerAvatar avatarId={r.avatarId} image={r.image} frameId={r.frameId} size="small" />
                  {r.username}
                </span>
                <span>{r.rank.label}</span>
                <strong>{r.points}</strong>
                <span>{r.wins}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>Le classement s’affichera dès les premières parties classées.</p>
      )}
    </div>
  );
}

