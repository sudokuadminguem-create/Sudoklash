"use client";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { formatClock } from "@/app/lib/format-time";
import { loadSoloSave, saveProgress, type SoloSave } from "@/app/lib/solo-save";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { soloDifficulties, type Difficulty } from "@/lib/difficulties";
import { PrivateLobby } from "./private-lobby";
import { RoomGame } from "./room-game";
import { SoloGame } from "./solo-game";
import { TimedChallenge } from "./timed-challenge";

export function ModePanel({
  mode,
  notify,
  account,
  cosmetics,
  openAuth,
}: {
  mode: string;
  notify: (s: string) => void;
  account: Account;
  cosmetics: Cosmetics;
  openAuth: () => void;
}) {
  const [chosen, setChosen] = useState<Difficulty | null>(null),
    [resuming, setResuming] = useState<SoloSave | undefined>(),
    [saved, setSaved] = useState<SoloSave | null>(null);
  const userId = account.user?.id ?? null;
  // Look for a game to resume each time the difficulty picker shows up.
  useEffect(() => {
    if (mode !== "solo" || chosen || account.loading) return;
    setSaved(loadSoloSave(userId));
  }, [mode, chosen, account.loading, userId]);
  if (mode === "solo")
    return chosen ? (
      <div>
        <div className="solo-bar">
          <button
            onClick={() => {
              setChosen(null);
              setResuming(undefined);
            }}
          >
            ← Changer de difficulté
          </button>
          <b>{chosen}</b>
          <span>Grille valide · solution unique</span>
        </div>
        <SoloGame
          key={chosen}
          difficulty={chosen}
          account={account}
          cosmetics={cosmetics}
          openAuth={openAuth}
          resume={resuming}
        />
      </div>
    ) : (
      <div className="panel">
        <div className="panel-head">
          <span className="eyebrow">ENTRAÎNEMENT</span>
          <h2>Choisis ta difficulté</h2>
          <p className="panel-copy">
            Chaque niveau utilise une grille 9×9 validée et une difficulté fondée sur les techniques
            nécessaires pour la résoudre.
          </p>
        </div>
        {saved && (
          <button
            className="resume-game"
            onClick={() => {
              setResuming(saved);
              setChosen(saved.difficulty);
            }}
          >
            <History />
            <span>
              <b>Reprendre ma partie</b>
              <small>
                {saved.difficulty} · {formatClock(saved.board.seconds)} · {saveProgress(saved)}%
                complétée
              </small>
            </span>
          </button>
        )}
        <div className="difficulty-grid">
          {soloDifficulties.map((d, i) => (
            <button
              onClick={() => {
                setChosen(d);
                notify(`Grille ${d} chargée`);
              }}
              key={d}
            >
              <span>{["🌱", "●", "◆", "▲", "⬢", "♛"][i]}</span>
              <b>{d}</b>
              <small>
                {
                  [
                    "Nus simples",
                    "Candidats uniques",
                    "Paires et blocs",
                    "Techniques avancées",
                    "Chaînes logiques",
                    "Logique extrême",
                  ][i]
                }
              </small>
            </button>
          ))}
        </div>
      </div>
    );
  if (mode === "daily") return <TimedChallenge kind="daily" openAuth={openAuth} />;
  if (mode === "hebdo") return <TimedChallenge kind="weekly" openAuth={openAuth} />;
  return (
    <PrivateLobby
      account={account}
      notify={notify}
      openAuth={openAuth}
      onRace={(room, players) => (
        <RoomGame room={room} players={players} account={account} notify={notify} />
      )}
    />
  );
}
