"use client";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { formatDuration } from "@/app/lib/format-time";
import { localJudge } from "@/app/lib/judge";
import { supabase } from "@/app/lib/supabase";
import type { Account } from "@/hooks/use-account";
import { solveGrid } from "@/lib/sudoku-solver";
import type { Room, RoomPlayer } from "./private-lobby";
import { SudokuBoard } from "./sudoku-board";

export function RoomGame({
  room,
  players,
  account,
  notify,
}: {
  room: Room;
  players: RoomPlayer[];
  account: Account;
  notify: (s: string) => void;
}) {
  const me = players.find((player) => player.user_id === account.user?.id),
    opponent = players.find((player) => player.user_id !== account.user?.id);
  const [now] = useState(() => Date.now()),
    startMs = room.started_at ? new Date(room.started_at).getTime() : now,
    initialSeconds = Math.max(0, Math.floor((now - startMs) / 1000));
  // Private rooms are run by Supabase functions, so the browser checks entries itself here.
  const puzzle = useMemo(() => room.puzzle.split("").map(Number), [room.puzzle]);
  const judge = useMemo(() => localJudge(puzzle, solveGrid(puzzle) ?? []), [puzzle]);
  const update = (filled: number) => {
    void supabase.rpc("update_room_progress", { p_room_id: room.id, p_progress: filled });
  };
  const complete = async (grid: number[]) => {
    const { data, error } = await supabase.rpc("complete_room", {
      p_room_id: room.id,
      p_grid: grid.join(""),
    });
    if (error) notify(error.message);
    else notify(`Grille validée en ${formatDuration(Math.floor(Number(data) / 1000))}`);
  };
  return (
    <div>
      <div className="solo-bar">
        <b>Salon {room.code}</b>
        <span>{room.status === "finished" ? "Course terminée" : "Course en direct"}</span>
      </div>
      <SudokuBoard
        key={room.id}
        difficulty="Intermédiaire"
        puzzle={puzzle}
        judge={judge}
        competitive
        title="Course privée 1 contre 1"
        active={room.status === "playing"}
        initialSeconds={initialSeconds}
        storageKey={`sudoku-clash-room-lives:${room.id}:${account.user?.id}`}
        onProgress={update}
        onSolved={complete}
        race={{
          meName: account.profile?.username || "Vous",
          opponentName: opponent?.profile?.username || "Adversaire",
          opponentProgress: opponent?.progress || 0,
        }}
      />
      {room.status === "finished" && (
        <div className="panel race-result">
          <Trophy />
          <h3>{room.winner_id === account.user?.id ? "Victoire !" : "Course terminée"}</h3>
          <p>
            {me?.elapsed_ms
              ? `Votre temps : ${formatDuration(Math.floor(me.elapsed_ms / 1000))}`
              : "Résultat enregistré"}
          </p>
        </div>
      )}
    </div>
  );
}
