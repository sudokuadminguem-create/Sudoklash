"use client";
import { useState } from "react";
import { authHeaders } from "@/app/lib/auth-headers";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { soloDifficulties, type Difficulty } from "@/lib/difficulties";
import { PrivateLobby } from "./private-lobby";
import { RoomGame } from "./room-game";
import { SudokuBoard } from "./sudoku-board";
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
  const [chosen, setChosen] = useState<Difficulty | null>(null);
  if (mode === "solo")
    return chosen ? (
      <div>
        <div className="solo-bar">
          <button onClick={() => setChosen(null)}>← Changer de difficulté</button>
          <b>{chosen}</b>
          <span>Grille valide · solution unique</span>
        </div>
        <SudokuBoard
          key={chosen}
          difficulty={chosen}
          title="Entraînement solo"
          soloExperience
          onConnect={openAuth}
          onSolved={async (grid, elapsedSeconds, puzzle) => {
            if (!account.user) return null;
            const response = await fetch("/api/account", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(await authHeaders()) },
              body: JSON.stringify({ difficulty: chosen, elapsedSeconds, puzzle, grid }),
            });
            if (!response.ok) throw new Error("save_failed");
            const result = (await response.json()) as { xpGained: number };
            void cosmetics.refresh();
            return result;
          }}
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
