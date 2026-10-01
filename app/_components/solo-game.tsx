"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/app/lib/i18n";
import { levelName } from "@/app/lib/i18n-core";
import { authHeaders } from "@/app/lib/auth-headers";
import { localJudge, type Judge } from "@/app/lib/judge";
import {
  clearSoloSave,
  storeSoloSave,
  type BoardSnapshot,
  type SoloLevel,
  type SoloSave,
  type StartedGame,
} from "@/app/lib/solo-save";
import { takeOfflineGrid } from "@/app/lib/offline-pack";
import { recordSoloWin, soloRecord } from "@/app/lib/solo-records";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { isSoloDifficulty } from "@/lib/difficulties";
import { geometryOf, variantByLabel } from "@/lib/variants";
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
  practice = false,
}: {
  difficulty: SoloLevel;
  account: Account;
  cosmetics: Cosmetics;
  openAuth: () => void;
  /** A saved game to carry on instead of starting a new one. */
  resume?: SoloSave;
  practice?: boolean;
}) {
  const [game, setGame] = useState<StartedGame | null>(resume?.game ?? null),
    [board, setBoard] = useState<BoardSnapshot | undefined>(resume?.board),
    [error, setError] = useState(false),
    [expired, setExpired] = useState(false),
    [offline, setOffline] = useState(false);
  const { t } = useI18n();
  const userId = account.user?.id ?? null;
  const signedIn = !!userId;
  // A variant has no logical hints to give: its judge answers digits only.
  const variant = variantByLabel(difficulty);
  const start = useCallback(async () => {
    setError(false);
    if ((practice || !navigator.onLine) && !variant && isSoloDifficulty(difficulty)) {
      const spare = takeOfflineGrid(difficulty);
      if (spare) {
        setBoard(undefined);
        setExpired(false);
        setOffline(true);
        setGame({ guest: true, ...spare });
        return;
      }
    }
    try {
      const started = await soloRequest<StartedGame>(
        variant ? { action: "start", variant } : { action: "start", difficulty },
      );
      setBoard(undefined);
      setExpired(false);
      setOffline(false);
      setGame(started);
    } catch {
      // No server: fall back on a spare practice grid stocked earlier, if this level has one.
      const spare = !variant && isSoloDifficulty(difficulty) ? takeOfflineGrid(difficulty) : null;
      if (spare) {
        setBoard(undefined);
        setExpired(false);
        setOffline(true);
        setGame({ guest: true, ...spare });
      } else setError(true);
    }
  }, [difficulty, variant, practice]);
  useEffect(() => {
    // A resumed game is kept as long as it belongs to who is playing.
    if (game && (game.guest === !signedIn || (game.guest && (offline || practice || !navigator.onLine))))
      return;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, signedIn]);

  const judge = useMemo<Judge | null>(() => {
    if (!game) return null;
    if (game.guest) {
      const local = localJudge(game.puzzle, game.solution);
      return variant ? { check: local.check } : local;
    }
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
      hint: variant
        ? undefined
        : async (grid, preferred) =>
            (
              await soloRequest<{ hint: { index: number; number: number } | null }>({
                action: "hint",
                gameId,
                grid,
                index: preferred,
              })
            ).hint,
    };
  }, [game, userId, variant]);
  const geometry = useMemo(() => geometryOf(game?.variant, game?.cages), [game]);

  // Records are per player, like saves: a guest game stays the guest's.
  const owner = game && !game.guest ? userId : null;
  // Read once per game, so the victory screen compares with the record before this win.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const previousBest = useMemo(() => (game ? soloRecord(owner, difficulty) : null), [game]);

  if (expired)
    return (
      <div className="panel weekly-state error">
        <p>{t("solo.expired")}</p>
        <button className="primary" onClick={() => void start()}>
          {t("solo.newGrid")}
        </button>
      </div>
    );
  if (error)
    return (
      <div className="panel weekly-state error">
        <p>{t("solo.loadError")}</p>
        <button className="primary" onClick={() => void start()}>
          {t("solo.retry")}
        </button>
      </div>
    );
  if (!game || !judge)
    return (
      <div className="game-card" role="status">
        {t("solo.preparing", { level: levelName(t, difficulty) })}
      </div>
    );
  return (
    <>
      {offline && (
        <p className="offline-note" role="status">
          {t("solo.offlineNote")}
        </p>
      )}
      <SudokuBoard
        key={game.guest ? game.puzzle.join("") : game.gameId}
        puzzle={game.puzzle}
        judge={judge}
        difficulty={difficulty}
        geometry={geometry}
        hintsAllowed={variant ? 0 : undefined}
        title={t("solo.title")}
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
          const updated = await cosmetics.refresh();
          return { ...result, totalXp: updated?.xp };
        }}
      />
    </>
  );
}
