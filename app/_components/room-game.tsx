"use client";
import { pseudonymClass } from "@/app/lib/pseudonym";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import type { Account } from "@/hooks/use-account";
import type { Judge } from "@/app/lib/judge";
import {
  roomRequest,
  type Room,
  type RoomPlayer,
  type RoomSnapshot,
} from "@/app/lib/private-rooms";
import { geometryOf } from "@/lib/variants";
import { SudokuBoard } from "./sudoku-board";

export function RoomGame({
  room,
  players,
  account,
  notify,
}: Readonly<{
  room: Room;
  players: RoomPlayer[];
  account: Account;
  notify: (s: string) => void;
}>) {
  const [mountedAt] = useState(Date.now);
  const [completeWinner, setCompleteWinner] = useState<string | null>(null);
  const [pendingGrid, setPendingGrid] = useState<string | null>(null);
  const winner = room.winner_id ?? completeWinner;
  const puzzle = useMemo(() => room.puzzle.split("").map(Number), [room.puzzle]);
  const geometry = useMemo(
    () => geometryOf(room.variant === "classic" ? undefined : room.variant, room.cages),
    [room.variant, room.cages],
  );
  const total = puzzle.filter((n) => n === 0).length;
  const judge: Judge = {
    check: (entry) =>
      roomRequest({ action: "check", id: room.id, index: entry.index, number: entry.number }),
  };
  const submit = async (grid: string) => {
    try {
      const result = await roomRequest<RoomSnapshot>({ action: "complete", id: room.id, grid });
      setCompleteWinner(result.room.winner_id);
      setPendingGrid(null);
    } catch (e) {
      setPendingGrid(grid);
      notify(e instanceof Error ? e.message : "Résultat indisponible.");
    }
  };
  return (
    <div>
      <div className="solo-bar">
        <b>Salon {room.code}</b>
        <span>
          {players.length}/{room.max_players} joueurs · {room.difficulty}
        </span>
      </div>
      {winner ? (
        <div className="panel race-result">
          <Trophy />
          <h3>{winner === account.user?.id ? "Victoire !" : "Course terminée"}</h3>
          <p>
            <span
              className={pseudonymClass(players.find((p) => p.user_id === winner)?.usernameColor)}
            >
              {players.find((p) => p.user_id === winner)?.username ?? "Un joueur"}
            </span>{" "}
            a terminé la grille en premier.
          </p>
        </div>
      ) : (
        <SudokuBoard
          key={room.id}
          geometry={geometry}
          difficulty={room.difficulty}
          puzzle={puzzle}
          judge={judge}
          competitive
          hintsAllowed={0}
          title="Course privée"
          initialSeconds={Math.max(
            0,
            Math.floor((mountedAt - (room.started_at ?? mountedAt)) / 1000),
          )}
          storageKey={`sudoku-clash-room-lives:${room.id}:${account.user?.id}`}
          onProgress={(_, grid) => {
            void roomRequest({ action: "progress", id: room.id, grid }).catch(() => {});
          }}
          onSolved={(grid) => submit(grid.join(""))}
        />
      )}
      {!winner && pendingGrid && (
        <button type="button" className="primary" onClick={() => void submit(pendingGrid)}>
          Réessayer de valider la grille
        </button>
      )}
      <section className="panel room-progress">
        <h3>Progression des joueurs</h3>
        {players.map((p) => (
          <div key={p.user_id}>
            <span className={pseudonymClass(p.usernameColor)}>
              {p.username ?? (p.user_id === account.user?.id ? "Toi" : "Joueur")}
            </span>
            <progress
              aria-label={`Progression de ${p.username ?? "joueur"}`}
              value={p.progress}
              max={total}
            />
            <b>
              {p.progress}/{total}
            </b>
          </div>
        ))}
      </section>
    </div>
  );
}
