"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handshake, Swords, Trophy, X } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { usePlayerAppearances } from "@/app/lib/use-player-appearances";
import { formatClock } from "@/app/lib/format-time";
import type { Judge } from "@/app/lib/judge";
import type { Account } from "@/hooks/use-account";
import { soloDifficulties, type Difficulty } from "@/lib/difficulties";
import { LockedPanel } from "./locked-panel";
import { PlayerAvatar } from "./player-cosmetics";
import { SudokuBoard } from "./sudoku-board";
import "../friend-duel.css";

export type DuelView = {
  id: string;
  status: "playing" | "finished";
  difficulty: Difficulty;
  puzzle: string;
  startedAt: number | null;
  finishedAt: number | null;
  winnerId: string | null;
  finishReason: "completed" | "three_mistakes" | "forfeit" | null;
  opponent: { id: string; username: string };
  myFilled: number;
  opponentFilled: number;
  totalToFill: number;
  mistakes: number;
  durationSeconds: number | null;
  record: { wins: number; losses: number };
};
export type DuelState = {
  incoming: { id: string; from: { id: string; username: string }; difficulty: string }[];
  outgoing: { id: string; to: { id: string; username: string }; difficulty: string } | null;
  duel: DuelView | null;
};
export type Friend = { id: string; username: string };

/** Difficulties offered for a duel: the hardest levels are too long for a friendly game. */
const duelDifficulties = soloDifficulties.slice(1, 5);

const errors: Record<string, string> = {
  busy: "Toi ou ton ami avez déjà un duel en cours ou en attente.",
  not_friends: "Vous n’êtes pas encore amis.",
  challenge_closed: "Ce défi n’est plus valable.",
  duel_not_found: "Ce duel n’existe plus.",
};

export async function duelRequest<T = DuelState>(
  action?: string,
  fields: Record<string, unknown> = {},
) {
  const response = await fetch("/api/duels", {
    method: action ? "POST" : "GET",
    cache: "no-store",
    headers: {
      ...(await authHeaders()),
      ...(action ? { "Content-Type": "application/json" } : {}),
    },
    ...(action ? { body: JSON.stringify({ action, ...fields }) } : {}),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok)
    throw new Error(
      errors[data.error ?? ""] ??
        (response.status === 401
          ? "Connecte-toi pour affronter tes amis."
          : "Les duels sont momentanément indisponibles."),
    );
  return data;
}

async function loadFriends(): Promise<Friend[]> {
  const response = await fetch("/api/friends", { cache: "no-store", headers: await authHeaders() });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    relationships: { status: string; otherUserId: string; username: string }[];
  };
  return data.relationships
    .filter((row) => row.status === "accepted")
    .map((row) => ({ id: row.otherUserId, username: row.username }));
}

const reasonText = (duel: DuelView, won: boolean) =>
  duel.finishReason === "three_mistakes"
    ? won
      ? `${duel.opponent.username} a fait trois erreurs`
      : "Fin après trois erreurs"
    : duel.finishReason === "forfeit"
      ? won
        ? `${duel.opponent.username} a abandonné`
        : "Partie abandonnée"
      : won
        ? "Grille terminée la première"
        : `${duel.opponent.username} a terminé la grille avant toi`;

/** Duels between friends: challenge, answer, play and rematch. */
export function FriendDuel({
  account,
  openAuth,
  notify,
  target,
  onTargetUsed,
}: {
  account: Account;
  openAuth: () => void;
  notify: (message: string) => void;
  /** A friend picked from the friends list, to challenge. */
  target?: Friend | null;
  onTargetUsed?: () => void;
}) {
  const [state, setState] = useState<DuelState | null>(null),
    [friends, setFriends] = useState<Friend[]>([]),
    [picked, setPicked] = useState<Friend | null>(target ?? null),
    [difficulty, setDifficulty] = useState<string>(duelDifficulties[1]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const userId = account.user?.id;
  const playing = state?.duel?.status === "playing";
  const appearances = usePlayerAppearances([
    ...friends.map((friend) => friend.id),
    ...(state?.incoming.map((invite) => invite.from.id) ?? []),
    state?.outgoing?.to.id ?? "",
    state?.duel?.opponent.id ?? "",
    picked?.id ?? "",
  ]);
  const avatar = (id: string) => (
    <PlayerAvatar
      avatarId={appearances[id]?.avatarId}
      frameId={appearances[id]?.frameId}
      image={appearances[id]?.image}
    />
  );

  const refresh = useCallback(async () => {
    try {
      setState(await duelRequest());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion indisponible");
    }
  }, []);
  // Faster while a game is on: the poll is also how the server knows both players are there.
  useEffect(() => {
    if (!userId) return;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), playing ? 1500 : 3000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [userId, refresh, playing]);
  useEffect(() => {
    if (!userId) return;
    void loadFriends().then(setFriends);
  }, [userId]);
  const usedTarget = useRef(false);
  useEffect(() => {
    if (target && !usedTarget.current) {
      usedTarget.current = true;
      onTargetUsed?.();
    }
  }, [target, onTargetUsed]);

  const send = async (action: string, fields: Record<string, unknown> = {}, done?: string) => {
    setBusy(true);
    setError("");
    try {
      await duelRequest(action, fields);
      if (done) notify(done);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };
  const challenge = async (friend: Friend, level: string) => {
    await send(
      "challenge",
      { friendId: friend.id, difficulty: level },
      `Défi envoyé à ${friend.username}`,
    );
    setPicked(null);
  };

  if (!account.user)
    return (
      <LockedPanel
        title="Défie tes amis"
        text="Connecte-toi pour lancer un duel à la même grille contre un ami."
        action={openAuth}
      />
    );

  if (state?.duel?.status === "playing")
    return (
      <DuelGame
        duel={state.duel}
        account={account}
        onForfeit={() => send("forfeit")}
        refresh={refresh}
        error={error}
      />
    );

  if (state?.duel?.status === "finished") {
    const duel = state.duel;
    const won = duel.winnerId === userId;
    return (
      <div className="panel ranked-lobby ranked-finished duel-finished">
        {won ? <Trophy /> : <X />}
        <span className="eyebrow">DUEL ENTRE AMIS</span>
        <h2>{won ? "Victoire !" : "Défaite"}</h2>
        <p>
          Contre {duel.opponent.username} · Grille {duel.difficulty} · {reasonText(duel, won)}
        </p>
        {avatar(duel.opponent.id)}
        <div className="ranked-summary">
          <div>
            <span>Durée</span>
            <strong>{formatClock(duel.durationSeconds ?? 0)}</strong>
          </div>
          <div>
            <span>Tes cases correctes</span>
            <strong>
              {duel.myFilled} / {duel.totalToFill}
            </strong>
          </div>
          <div>
            <span>Cases de {duel.opponent.username}</span>
            <strong>
              {duel.opponentFilled} / {duel.totalToFill}
            </strong>
          </div>
          <div>
            <span>Bilan entre vous</span>
            <strong>
              {duel.record.wins} – {duel.record.losses}
            </strong>
          </div>
        </div>
        <div className="duel-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void (async () => {
                await send("dismiss", { id: duel.id });
                await challenge(duel.opponent, duel.difficulty);
              })()
            }
          >
            Revanche
          </button>
          <button disabled={busy} onClick={() => void send("dismiss", { id: duel.id })}>
            Fermer
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="panel duel-lobby">
      <Handshake />
      <span className="eyebrow">DUEL ENTRE AMIS</span>
      <h2>Même grille, premier arrivé</h2>
      <p>
        Défie un ami : vous jouez la même grille en même temps, chacun voit la progression de
        l’autre. Aucun point n’est en jeu.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {state?.incoming.map((invite) => (
        <div className="duel-card incoming" key={invite.id} role="status">
          <Swords />
          {avatar(invite.from.id)}
          <div>
            <b>{invite.from.username} te défie !</b>
            <small>Grille {invite.difficulty}</small>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void send("accept", { id: invite.id })}
          >
            Accepter
          </button>
          <button
            className="subtle"
            disabled={busy}
            onClick={() => void send("decline", { id: invite.id })}
          >
            Refuser
          </button>
        </div>
      ))}

      {state?.outgoing ? (
        <div className="duel-card waiting" role="status">
          <span className="ranked-spinner" />
          {avatar(state.outgoing.to.id)}
          <div>
            <b>En attente de {state.outgoing.to.username}</b>
            <small>Grille {state.outgoing.difficulty} · le défi expire dans 10 minutes</small>
          </div>
          <button
            className="subtle"
            disabled={busy}
            onClick={() => void send("cancel", { id: state.outgoing!.id })}
          >
            Annuler
          </button>
        </div>
      ) : picked ? (
        <div className="duel-card composing">
          {avatar(picked.id)}
          <div>
            <b>Défier {picked.username}</b>
            <div className="duel-levels" role="radiogroup" aria-label="Difficulté du duel">
              {duelDifficulties.map((level) => (
                <button
                  key={level}
                  role="radio"
                  aria-checked={level === difficulty}
                  className={level === difficulty ? "active" : ""}
                  onClick={() => setDifficulty(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void challenge(picked, difficulty)}
          >
            Envoyer le défi
          </button>
          <button className="subtle" disabled={busy} onClick={() => setPicked(null)}>
            Annuler
          </button>
        </div>
      ) : (
        <div className="duel-friends">
          <h3>Tes amis</h3>
          {friends.length === 0 ? (
            <p className="empty-real">
              Tu n’as pas encore d’amis. Ajoute un joueur depuis l’onglet « Amis » pour le défier.
            </p>
          ) : (
            friends.map((friend) => (
              <div className="duel-friend" key={friend.id}>
                {avatar(friend.id)}
                <b>{friend.username}</b>
                <button
                  disabled={busy || (state?.incoming.length ?? 0) > 0}
                  onClick={() => setPicked(friend)}
                >
                  <Swords />
                  Défier
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DuelGame({
  duel,
  account,
  onForfeit,
  refresh,
  error,
}: {
  duel: DuelView;
  account: Account;
  onForfeit: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string;
}) {
  const [confirming, setConfirming] = useState(false),
    [pendingGrid, setPendingGrid] = useState<number[] | null>(null),
    [completeError, setCompleteError] = useState("");
  const puzzle = useMemo(() => duel.puzzle.split("").map(Number), [duel.puzzle]);
  // Seconds already played when the screen opens (after a reload, say); the board counts on.
  const [initialSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - (duel.startedAt ?? Date.now())) / 1000)),
  );
  // The server holds the solution: it checks each digit and records progress and mistakes.
  const judge = useMemo<Judge>(
    () => ({
      check: async ({ index, number, id }) => {
        const result = await duelRequest<{ correct: boolean; mistakes: number }>("check", {
          index,
          number,
          mistakeId: id,
        });
        void refresh();
        return { correct: !!result.correct, mistakes: result.mistakes };
      },
    }),
    [refresh],
  );
  const complete = async (grid: number[]) => {
    setPendingGrid(grid);
    try {
      await duelRequest("complete", { grid });
      setCompleteError("");
      setPendingGrid(null);
      await refresh();
    } catch {
      setCompleteError("Impossible d’enregistrer le résultat. Réessaie.");
    }
  };
  return (
    <div className="ranked-game duel-game">
      <div className="solo-bar">
        <b>
          Duel contre {duel.opponent.username} · Grille {duel.difficulty}
        </b>
        <span>
          Bilan : {duel.record.wins} – {duel.record.losses}
        </span>
        {confirming ? (
          <span className="duel-confirm">
            <button className="ranked-forfeit" onClick={() => void onForfeit()}>
              Abandonner
            </button>
            <button onClick={() => setConfirming(false)}>Continuer</button>
          </span>
        ) : (
          <button className="ranked-forfeit" onClick={() => setConfirming(true)}>
            Abandonner
          </button>
        )}
      </div>
      <SudokuBoard
        key={duel.id}
        difficulty={duel.difficulty}
        puzzle={puzzle}
        judge={judge}
        competitive
        title="Duel entre amis"
        modeLabel="DUEL ENTRE AMIS"
        initialSeconds={initialSeconds}
        initialMistakes={duel.mistakes}
        hintsAllowed={0}
        onSolved={(grid) => void complete(grid)}
        race={{
          meName: account.profile?.username || "Toi",
          opponentName: duel.opponent.username,
          opponentProgress: duel.opponentFilled,
          totalToFill: duel.totalToFill,
        }}
      />
      {(error || completeError) && (
        <div className="weekly-error" role="alert">
          {completeError || error}
          {pendingGrid && <button onClick={() => void complete(pendingGrid)}>Réessayer</button>}
        </div>
      )}
    </div>
  );
}
