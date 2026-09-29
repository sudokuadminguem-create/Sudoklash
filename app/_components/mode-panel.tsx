"use client";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { formatClock } from "@/app/lib/format-time";
import { useSettings } from "@/app/lib/settings";
import { loadSoloSave, saveProgress, type SoloSave } from "@/app/lib/solo-save";
import { ConfirmDialog } from "./confirm-dialog";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { soloDifficulties, type Difficulty } from "@/lib/difficulties";
import { soloXpFor } from "@/lib/cosmetics";
import { PrivateLobby } from "./private-lobby";
import { RoomGame } from "./room-game";
import { SoloGame } from "./solo-game";
import { NearChallenges } from "./near-challenges";
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
    [saved, setSaved] = useState<SoloSave | null>(null),
    [replacing, setReplacing] = useState<Difficulty | null>(null);
  const { settings } = useSettings();
  const pick = (d: Difficulty) => {
    setChosen(d);
    notify(`Grille ${d} chargée`);
  };
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
      <div className="solo-picker">
      <NearChallenges account={account} cosmetics={cosmetics} />
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
              // A new grid replaces the saved one: ask first.
              onClick={() => (saved && settings.confirmNewGrid ? setReplacing(d) : pick(d))}
              key={d}
            >
              <span>{["🌱", "●", "◆", "▲", "⬢", "♛"][i]}</span>
              <b>{d}</b>
              <small>
                {
                  [
                    "Cases à chiffre unique",
                    "Chiffre unique dans une ligne ou un bloc",
                    "Candidats bloqués",
                    "Paires",
                    "Triples et X-Wing",
                    "Techniques au-delà de l’Expert",
                  ][i]
                }
              </small>
              <span className="difficulty-xp">+{soloXpFor(d)} XP</span>
            </button>
          ))}
        </div>
        {replacing && saved && (
          <ConfirmDialog
            title="Remplacer ta partie en cours ?"
            message={`Ta partie ${saved.difficulty} commencée sera perdue si tu lances une nouvelle grille ${replacing}.`}
            confirmLabel="Nouvelle grille"
            cancelLabel="Garder ma partie"
            onCancel={() => setReplacing(null)}
            onConfirm={() => {
              setReplacing(null);
              pick(replacing);
            }}
          />
        )}
      </div>
      </div>
    );
  if (mode === "daily") return <TimedChallenge kind="daily" openAuth={openAuth} cosmetics={cosmetics} />;
  if (mode === "hebdo") return <TimedChallenge kind="weekly" openAuth={openAuth} cosmetics={cosmetics} />;
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
