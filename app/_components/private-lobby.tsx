"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Users } from "lucide-react";
import { friendlyError } from "@/app/lib/auth-messages";
import { supabase } from "@/app/lib/supabase";
import type { Account, Profile } from "@/hooks/use-account";
import { solvePuzzle } from "@/lib/sudoku-solver";
import { LockedPanel } from "./locked-panel";
import { PlayerAvatar } from "./player-cosmetics";

export type Room = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "finished" | "cancelled";
  difficulty: string;
  puzzle: string;
  max_players: number;
  started_at: string | null;
  winner_id: string | null;
};
export type RoomPlayer = {
  room_id: string;
  user_id: string;
  is_ready: boolean;
  progress: number;
  finished_at: string | null;
  elapsed_ms: number | null;
  profile?: Profile | null;
};

export function PrivateLobby({
  account,
  notify,
  openAuth,
  onRace,
}: {
  account: Account;
  notify: (s: string) => void;
  openAuth: () => void;
  onRace: (room: Room, players: RoomPlayer[]) => React.ReactNode;
}) {
  const [room, setRoom] = useState<Room | null>(null),
    [players, setPlayers] = useState<RoomPlayer[]>([]),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [appearances, setAppearances] = useState<Record<string, { avatarId: string; frameId: string; image: string | null }>>({});
  const me = account.user?.id;
  const playerIds = players.map((player) => player.user_id).join(",");
  useEffect(() => {
    if (!playerIds) return;
    let active = true;
    fetch(`/api/players/appearance?ids=${encodeURIComponent(playerIds)}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ appearances?: Array<{ id: string; avatarId: string; frameId: string; image: string | null }> }>)
      .then((data) => {
        if (active) setAppearances(Object.fromEntries((data.appearances ?? []).map(({ id, ...appearance }) => [id, appearance])));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [playerIds]);
  const load = useCallback(async (roomId: string) => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", roomId).single(),
      supabase
        .from("room_players")
        .select(
          "*,profile:profiles!room_players_user_id_fkey(id,username,display_name,avatar_url,last_seen)",
        )
        .eq("room_id", roomId)
        .order("joined_at"),
    ]);
    if (r) setRoom(r as Room);
    if (p) setPlayers(p as unknown as RoomPlayer[]);
  }, []);
  useEffect(() => {
    if (!room?.id) return;
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        () => load(room.id),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${room.id}` },
        () => load(room.id),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id, load]);
  if (!account.user)
    return (
      <LockedPanel
        title="Jouez vraiment à plusieurs"
        text="Un compte est nécessaire pour créer ou rejoindre un salon privé synchronisé."
        action={openAuth}
      />
    );
  const create = async () => {
    setBusy(true);
    const game = "Intermédiaire";
    const puzzle =
      "000260701680070090190004500820100040004602900050003028009300074040050036703018000";
    const solution = solvePuzzle(puzzle);
    if (!solution) throw new Error("Grille invalide");
    const { data, error } = await supabase.rpc("create_room", {
      p_difficulty: game,
      p_puzzle: puzzle,
      p_solution: solution.join(""),
      p_max_players: 2,
    });
    setBusy(false);
    if (error) return notify(friendlyError(error.message));
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      await load(row.room_id);
      notify("Salon créé");
    }
  };
  const join = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("join_room", { p_code: code.trim().toUpperCase() });
    setBusy(false);
    if (error) return notify(friendlyError(error.message));
    if (data) await load(data as string);
  };
  const toggleReady = async () => {
    const current = players.find((p) => p.user_id === me);
    if (!room || !current) return;
    const { error } = await supabase.rpc("set_room_ready", {
      p_room_id: room.id,
      p_ready: !current.is_ready,
    });
    if (error) notify(friendlyError(error.message));
    else await load(room.id);
  };
  const start = async () => {
    if (!room) return;
    const { error } = await supabase.rpc("start_room", { p_room_id: room.id });
    if (error) notify(friendlyError(error.message));
    else await load(room.id);
  };
  if (room?.status === "playing" || room?.status === "finished")
    return <>{onRace(room, players)}</>;
  if (!room)
    return (
      <div className="panel private real-private">
        <Users />
        <h2>Salon privé réel</h2>
        <p>Créez une course synchronisée ou saisissez le code reçu d’un ami.</p>
        <div className="private-choices">
          <button className="primary" disabled={busy} onClick={create}>
            {busy ? "Création…" : "Créer un salon 1 contre 1"}
          </button>
          <span>OU</span>
          <div>
            <input
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .replace(/[^a-z0-9]/gi, "")
                    .slice(0, 6)
                    .toUpperCase(),
                )
              }
              placeholder="CODE À 6 CARACTÈRES"
            />
            <button disabled={busy || code.length !== 6} onClick={join}>
              Rejoindre
            </button>
          </div>
        </div>
      </div>
    );
  const self = players.find((p) => p.user_id === me);
  const allReady = players.length >= 2 && players.every((p) => p.is_ready);
  return (
    <div className="panel private real-private">
      <Users />
      <span className="eyebrow">SALON PRIVÉ</span>
      <h2>
        Code <b>{room.code}</b>
      </h2>
      <button
        className="copy-code"
        onClick={() => navigator.clipboard.writeText(room.code).then(() => notify("Code copié"))}
      >
        <Copy />
        Copier le code
      </button>
      <div className="lobby-list">
        {players.map((p) => (
          <div key={p.user_id}>
            <PlayerAvatar avatarId={appearances[p.user_id]?.avatarId} frameId={appearances[p.user_id]?.frameId} image={appearances[p.user_id]?.image} />
            <span>
              <b>{p.profile?.username || "Joueur"}</b>
              <small>{p.user_id === room.host_id ? "Hôte" : "Invité"}</small>
            </span>
            <em className={p.is_ready ? "ready" : ""}>{p.is_ready ? "PRÊT" : "EN ATTENTE"}</em>
          </div>
        ))}
      </div>
      <button className="primary" onClick={toggleReady}>
        {self?.is_ready ? "Annuler prêt" : "Je suis prêt"}
      </button>
      {me === room.host_id && (
        <button className="primary start-room" disabled={!allReady} onClick={start}>
          {players.length < 2
            ? "En attente d’un adversaire"
            : allReady
              ? "Lancer la course"
              : "Tous les joueurs doivent être prêts"}
        </button>
      )}
    </div>
  );
}

