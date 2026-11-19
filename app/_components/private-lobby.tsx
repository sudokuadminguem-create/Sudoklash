"use client";
import { useEffect, useState } from "react";
import { Copy, Users } from "lucide-react";
import type { Account } from "@/hooks/use-account";
import { soloDifficulties, type Difficulty } from "@/lib/difficulties";
import { variantIds, variantInfo, type VariantId } from "@/lib/variants";
import {
  roomRequest,
  type Room,
  type RoomPlayer,
  type RoomSnapshot,
} from "@/app/lib/private-rooms";
import { usePlayerAppearances } from "@/app/lib/use-player-appearances";
import { LockedPanel } from "./locked-panel";
import { PlayerAvatar } from "./player-cosmetics";
import { RoomGame } from "./room-game";
import "../private-room.css";

export function startLabel(playerCount: number, allReady: boolean) {
  if (playerCount < 2) return "En attente d’un adversaire";
  return allReady ? "Lancer la course" : "Tous les joueurs doivent être prêts";
}

export function PrivateLobby({
  account,
  notify,
  openAuth,
}: Readonly<{
  account: Account;
  notify: (s: string) => void;
  openAuth: () => void;
}>) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>("Intermédiaire");
  const [variant, setVariant] = useState<"classic" | VariantId>("classic");
  const { room, players } = snapshot ?? { room: null, players: [] };
  const me = account.user?.id;
  const appearances = usePlayerAppearances(players.map((player) => player.user_id));
  const roomId = room?.id;
  useEffect(() => {
    if (!roomId || !me || room?.winner_id) return;
    let live = true,
      pending = false;
    const timer = setInterval(async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const updated = await roomRequest<RoomSnapshot>(undefined, roomId);
        if (live)
          setSnapshot((previous) =>
            previous?.room.id === roomId &&
            !previous.room.winner_id &&
            !(previous.room.started_at && !updated.room.started_at)
              ? updated
              : previous,
          );
      } catch {
        // Keep the current room visible while the connection recovers.
      } finally {
        pending = false;
      }
    }, 2500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [roomId, me, room?.winner_id]);
  useEffect(() => {
    setSnapshot(null);
  }, [me]);
  if (!account.user)
    return (
      <LockedPanel
        title="Jouez vraiment à plusieurs"
        text="Un compte est nécessaire pour créer ou rejoindre un salon privé synchronisé."
        action={openAuth}
      />
    );
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      setSnapshot(await roomRequest<RoomSnapshot>(body));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Salon indisponible.");
    } finally {
      setBusy(false);
    }
  };
  if (room?.started_at)
    return (
      <>
        <RoomGame key={room.id} room={room} players={players} account={account} notify={notify} />
        {room.winner_id && (
          <button className="primary" onClick={() => setSnapshot(null)}>
            Retour aux salons privés
          </button>
        )}
      </>
    );
  if (!room)
    return (
      <div className="panel private real-private">
        <Users />
        <h2>Salon privé</h2>
        <p>Créez une course synchronisée ou saisissez le code reçu d’un ami.</p>
        <fieldset className="room-settings" disabled={busy}>
          <legend>Paramètres de la partie</legend>
          <label>
            <span>Nombre maximal de joueurs</span>
            <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
              {Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} joueurs
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Mode de jeu</span>
            <select value={variant} onChange={(e) => setVariant(e.target.value as typeof variant)}>
              <option value="classic">Classique 9×9</option>
              {variantIds.map((id) => (
                <option key={id} value={id}>
                  {variantInfo[id].label}
                </option>
              ))}
            </select>
          </label>
          {variant === "classic" ? (
            <label>
              <span>Difficulté</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                {soloDifficulties.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              {variantInfo[variant].tagline}. Comme en solo, la difficulté est propre à cette
              variante.
            </p>
          )}
        </fieldset>
        <div className="private-choices">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void send({ action: "create", maxPlayers, difficulty, variant })}
          >
            {busy ? "Création…" : "Créer un salon"}
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
              aria-label="Code du salon"
              placeholder="CODE À 6 CARACTÈRES"
            />
            <button
              disabled={busy || code.length !== 6}
              onClick={() => void send({ action: "join", code })}
            >
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
      <p>
        {room.variant === "classic" ? `Classique 9×9 · ${room.difficulty}` : room.difficulty} ·{" "}
        {players.length}/{room.max_players} joueurs
      </p>
      <div className="lobby-list">
        {players.map((p) => (
          <div key={p.user_id}>
            <PlayerAvatar
              avatarId={appearances[p.user_id]?.avatarId}
              frameId={appearances[p.user_id]?.frameId}
              image={appearances[p.user_id]?.image}
            />
            <span>
              <b>{p.username || "Joueur"}</b>
              <small>{p.user_id === room.host_id ? "Hôte" : "Invité"}</small>
            </span>
            <em className={p.is_ready ? "ready" : ""}>{p.is_ready ? "PRÊT" : "EN ATTENTE"}</em>
          </div>
        ))}
      </div>
      <button
        className="primary"
        disabled={busy || !self}
        onClick={() => void send({ action: "ready", id: room.id, ready: !self?.is_ready })}
      >
        {self?.is_ready ? "Annuler prêt" : "Je suis prêt"}
      </button>
      {me === room.host_id && (
        <button
          className="primary start-room"
          disabled={busy || !allReady}
          onClick={() => void send({ action: "start", id: room.id })}
        >
          {startLabel(players.length, allReady)}
        </button>
      )}
    </div>
  );
}
