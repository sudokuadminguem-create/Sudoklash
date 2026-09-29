"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders } from "@/app/lib/auth-headers";
import { localJudge, type Judge } from "@/app/lib/judge";
import {
  clearSoloSave,
  storeSoloSave,
  type BoardSnapshot,
  type SoloSave,
  type StartedGame,
} from "@/app/lib/solo-save";
import { recordSoloWin, soloRecord } from "@/app/lib/solo-records";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import type { Difficulty } from "@/lib/difficulties";
import { SudokuBoard } from "./sudoku-board";

async function soloRequest<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/solo", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "solo_unavailable");
  return data;
}

/** Errors meaning the server no longer has this game open (replaced on another device…). */
const gone = (error: unknown) =>
  error instanceof Error && (error.message === "game_not_found" || error.message === "game_over");

/**
 * A solo grid served by the server. Signed-in players never receive the solution: the
 * server checks digits, gives hints and times the game before granting XP.
 * The game in progress is saved in the browser so it can be resumed later.
 */
export function SoloGame({
  difficulty,
  account,
  cosmetics,
  openAuth,
  resume,
}: {
  difficulty: Difficulty;
  account: Account;
  cosmetics: Cosmetics;
  openAuth: () => void;
  /** A saved game to carry on instead of starting a new one. */
  resume?: SoloSave;
}) {
  const [game, setGame] = useState<StartedGame | null>(resume?.game ?? null),
    [board, setBoard] = useState<BoardSnapshot | undefined>(resume?.board),
    [error, setError] = useState(false),
    [expired, setExpired] = useState(false);
  const userId = account.user?.id ?? null;
  const signedIn = !!userId;
  const start = useCallback(async () => {
    setError(false);
    try {
      const started = await soloRequest<StartedGame>({ action: "start", difficulty });
      setBoard(undefined);
      setExpired(false);
      setGame(started);
    } catch {
      setError(true);
    }
  }, [difficulty]);
  useEffect(() => {
    // A resumed game is kept as long as it belongs to who is playing.
    if (game && game.guest === !signedIn) return;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, signedIn]);

  const judge = useMemo<Judge | null>(() => {
    if (!game) return null;
    if (game.guest) return localJudge(game.puzzle, game.solution);
    const { gameId } = game;
    return {
      check: ({ index, number, id }) =>
        soloRequest<{ correct: boolean; mistakes: number }>({
          action: "check",
          gameId,
          index,
          number,
          mistakeId: id,
        }).catch((e: unknown) => {
          if (gone(e)) {
            clearSoloSave(userId);
            setExpired(true);
          }
          throw e;
        }),
      hint: async (grid, preferred) =>
        (
          await soloRequest<{ hint: { index: number; number: number } | null }>({
            action: "hint",
            gameId,
            grid,
            index: preferred,
          })
        ).hint,
    };
  }, [game, userId]);

  // Records are per player, like saves: a guest game stays the guest's.
  const owner = game && !game.guest ? userId : null;
  // Read once per game, so the victory screen compares with the record before this win.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previousBest = useMemo(() => (game ? soloRecord(owner, difficulty) : null), [game]);

  if (expired)
    return (
      <div className="panel weekly-state error">
        <p>Cette partie n’est plus disponible : une autre grille a été lancée depuis.</p>
        <button className="primary" onClick={() => void start()}>
          Nouvelle grille
        </button>
      </div>
    );
  if (error)
    return (
      <div className="panel weekly-state error">
        <p>Impossible de charger une grille. Vérifiez votre connexion.</p>
        <button className="primary" onClick={() => void start()}>
          Réessayer
        </button>
      </div>
    );
  if (!game || !judge)
    return (
      <div className="game-card" role="status">
        Préparation d’une nouvelle grille {difficulty}…
      </div>
    );
  return (
    <SudokuBoard
      key={game.guest ? game.puzzle.join("") : game.gameId}
      puzzle={game.puzzle}
      judge={judge}
      difficulty={difficulty}
      title="Entraînement solo"
      soloExperience
      onConnect={openAuth}
      resume={board}
      previousBest={previousBest}
      onSnapshot={(snapshot) => {
        // Guest games stay with the guest, even if the player signs in meanwhile.
        if (snapshot) storeSoloSave(owner, { difficulty, game, board: snapshot });
        else clearSoloSave(owner);
      }}
      onNewGame={() => void start()}
      onSolved={async (grid, seconds) => {
        recordSoloWin(owner, difficulty, seconds);
        if (game.guest) return null;
        const result = await soloRequest<{ xpGained: number }>({
          action: "complete",
          gameId: game.gameId,
          grid,
        });
        window.dispatchEvent(new Event("sudoklash:progress"));
        void cosmetics.refresh();
        return result;
      }}
    />
  );
}
