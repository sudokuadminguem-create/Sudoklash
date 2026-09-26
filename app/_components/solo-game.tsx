"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders } from "@/app/lib/auth-headers";
import { localJudge, type Judge } from "@/app/lib/judge";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import type { Difficulty } from "@/lib/difficulties";
import { SudokuBoard } from "./sudoku-board";

type StartedGame =
  | { guest: true; puzzle: number[]; solution: number[] }
  | { guest: false; gameId: string; puzzle: number[] };

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

/**
 * A solo grid served by the server. Signed-in players never receive the solution: the
 * server checks digits, gives hints and times the game before granting XP.
 */
export function SoloGame({
  difficulty,
  account,
  cosmetics,
  openAuth,
}: {
  difficulty: Difficulty;
  account: Account;
  cosmetics: Cosmetics;
  openAuth: () => void;
}) {
  const [game, setGame] = useState<StartedGame | null>(null),
    [error, setError] = useState(false);
  const signedIn = !!account.user;
  const start = useCallback(async () => {
    setError(false);
    try {
      setGame(await soloRequest<StartedGame>({ action: "start", difficulty }));
    } catch {
      setError(true);
    }
  }, [difficulty]);
  useEffect(() => {
    void start();
  }, [start, signedIn]);

  const judge = useMemo<Judge | null>(() => {
    if (!game) return null;
    if (game.guest) return localJudge(game.puzzle, game.solution);
    const { gameId } = game;
    return {
      check: ({ index, number, id }) =>
        soloRequest({ action: "check", gameId, index, number, mistakeId: id }),
      hint: async (grid) =>
        (
          await soloRequest<{ hint: { index: number; number: number } | null }>({
            action: "hint",
            gameId,
            grid,
          })
        ).hint,
    };
  }, [game]);

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
      onNewGame={() => void start()}
      onSolved={async (grid) => {
        if (game.guest) return null;
        const result = await soloRequest<{ xpGained: number }>({
          action: "complete",
          gameId: game.gameId,
          grid,
        });
        void cosmetics.refresh();
        return result;
      }}
    />
  );
}
