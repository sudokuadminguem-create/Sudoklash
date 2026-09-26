"use client";
import { useMemo, useState } from "react";
import type { Judge } from "@/app/lib/judge";
import type { Account } from "@/hooks/use-account";
import { rankedRequest, type RankedState } from "./ranked-match";
import { SudokuBoard } from "./sudoku-board";

export function RankedGame({
  match,
  refresh,
  account,
}: {
  match: RankedState;
  refresh: () => Promise<void>;
  account: Account;
}) {
  const [error, setError] = useState(""),
    [pendingGrid, setPendingGrid] = useState<number[] | null>(null);
  const puzzle = useMemo(() => match.puzzle?.split("").map(Number) ?? [], [match.puzzle]);
  const complete = async (grid: number[]) => {
    setPendingGrid(grid);
    try {
      await rankedRequest("complete", { grid });
      setError("");
      setPendingGrid(null);
      await refresh();
    } catch {
      setError("Impossible d’enregistrer le résultat. Réessaie.");
    }
  };
  // The server holds the solution: it checks each digit and records progress and mistakes.
  const judge = useMemo<Judge>(
    () => ({
      check: async ({ index, number, id }, grid) => {
        const result = await rankedRequest("check", { index, number, mistakeId: id, grid });
        void refresh();
        return { correct: !!result.correct, mistakes: result.mistakes ?? 0 };
      },
    }),
    [refresh],
  );
  return (
    <div className="ranked-game">
      <div className="solo-bar">
        <b>
          {match.rank?.label ?? "Partie classée"} · Grille {match.difficulty}
        </b>
        <span>Adversaire trouvé : {match.opponentName}</span>
      </div>
      <SudokuBoard
        key={match.id}
        difficulty={match.difficulty ?? "Intermédiaire"}
        puzzle={puzzle}
        judge={judge}
        competitive
        title="Duel classé 1 contre 1"
        active={match.status === "playing"}
        initialSeconds={Math.max(
          0,
          Math.floor((Date.now() - (match.startedAt ?? Date.now())) / 1000),
        )}
        initialMistakes={match.mistakes ?? 0}
        hintsAllowed={0}
        onSolved={(grid) => void complete(grid)}
        race={{
          meName: account.profile?.username || "Vous",
          opponentName: match.opponentName ?? "Adversaire",
          opponentProgress: match.opponentProgress ?? 0,
          totalToFill: match.totalToFill,
        }}
      />
      {error && (
        <div className="weekly-error" role="alert">
          {error}
          {pendingGrid && <button onClick={() => void complete(pendingGrid)}>Réessayer</button>}
        </div>
      )}
    </div>
  );
}
