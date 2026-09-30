"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Search, Swords, UserPlus, X } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import type { Account } from "@/hooks/use-account";
import { PlayerAvatar } from "./player-cosmetics";
import { ProfileCardDisplay, type CardStats, type ProfileLook } from "./profile-card";

type Relationship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  username: string;
  otherUserId: string;
  avatarId: string;
  frameId: string;
  image: string | null;
};
type Player = {
  id: string;
  username: string;
  avatarId: string;
  frameId: string;
  image: string | null;
};
type FriendProfile = CardStats & ProfileLook & { username: string };
type FriendsData = { players: Player[]; nextOffset: number | null; relationships: Relationship[] };
const emptyData: FriendsData = { players: [], nextOffset: null, relationships: [] };

export default function FriendsDirectory({
  account,
  notify,
  onChallenge,
  requestFocus = 0,
}: {
  account: Account;
  notify: (message: string) => void;
  /** Opens the duel screen with this friend ready to be challenged. */
  onChallenge?: (friend: { id: string; username: string }) => void;
  requestFocus?: number;
}) {
  const [tab, setTab] = useState<"players" | "friends" | "requests">("players");
  useEffect(() => {
    if (requestFocus > 0) setTab("requests");
  }, [requestFocus]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<FriendsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/friends?search=${encodeURIComponent(search)}&offset=${offset}`,
          { cache: "no-store", headers: await authHeaders() },
        );
        if (!response.ok) throw new Error("load_failed");
        const next = (await response.json()) as FriendsData;
        setData((current) =>
          offset ? { ...next, players: [...current.players, ...next.players] } : next,
        );
      } catch {
        setError("Impossible de charger les joueurs. Réessayez.");
      } finally {
        setLoading(false);
      }
    },
    [search],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const mine = data.relationships.filter((row) => row.status === "accepted");
  const incoming = data.relationships.filter(
    (row) => row.status === "pending" && row.addressee_id === account.user?.id,
  );
  const outgoing = data.relationships.filter(
    (row) => row.status === "pending" && row.requester_id === account.user?.id,
  );
  const relationFor = (id: string) =>
    data.relationships.find((row) => row.requester_id === id || row.addressee_id === id);

  const showProfile = async (friendId: string) => {
    setTab("friends");
    setProfileLoading(true);
    setProfileError("");
    setSelectedFriend(null);
    try {
      const response = await fetch(`/api/friends/profile?id=${encodeURIComponent(friendId)}`, {
        cache: "no-store",
        headers: await authHeaders(),
      });
      if (!response.ok) throw new Error("profile_unavailable");
      setSelectedFriend((await response.json()) as FriendProfile);
    } catch {
      setProfileError("Impossible de charger ce profil. Réessayez.");
    } finally {
      setProfileLoading(false);
    }
  };

  const avatar = (person: {
    username: string;
    avatarId: string;
    frameId: string;
    image?: string | null;
  }) => <PlayerAvatar avatarId={person.avatarId} frameId={person.frameId} image={person.image} />;

  const action = async (
    body: { action: "send" | "accept" | "decline"; username?: string; id?: string },
    key: string,
  ) => {
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        const message: Record<string, string> = {
          player_not_found: "Pseudo introuvable.",
          already_friends: "Vous êtes déjà amis.",
          request_pending: "Demande déjà envoyée.",
          incoming_request: "Cette personne vous a déjà envoyé une demande.",
        };
        throw new Error(message[result.error ?? ""] ?? "Action impossible. Réessayez.");
      }
      notify(
        body.action === "send"
          ? "Demande d’ami envoyée"
          : body.action === "accept"
            ? "Ami ajouté"
            : "Demande refusée",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const playerRow = (player: Player) => {
    const relation = relationFor(player.id);
    return (
      <div className="friend player-entry" key={player.id}>
        {avatar({ ...player, image: player.image ?? relation?.image })}
        <div>
          <b>{player.username}</b>
          <small>
            {relation?.status === "accepted"
              ? "Déjà ami"
              : relation?.status === "pending"
                ? relation.requester_id === account.user?.id
                  ? "Demande envoyée"
                  : "Vous a envoyé une demande"
                : "Joueur Sudoku Clash"}
          </small>
        </div>
        {(!relation || relation.status === "declined") && (
          <button
            disabled={busy !== null}
            onClick={() => void action({ action: "send", username: player.username }, player.id)}
          >
            <UserPlus />
            {busy === player.id ? "Envoi…" : "Ajouter"}
          </button>
        )}
        {relation?.status === "pending" && relation.addressee_id === account.user?.id && (
          <button
            disabled={busy !== null}
            onClick={() => void action({ action: "accept", id: relation.id }, relation.id)}
          >
            <Check />
            Accepter
          </button>
        )}
        {relation?.status === "accepted" && (
          <button onClick={() => void showProfile(player.id)}>Voir profil</button>
        )}
      </div>
    );
  };

  return (
    <div className="panel friends-directory">
      <div className="friends-tabs" role="tablist" aria-label="Amis et joueurs">
        <button
          role="tab"
          aria-selected={tab === "players"}
          className={tab === "players" ? "active" : ""}
          onClick={() => setTab("players")}
        >
          Tous les joueurs
        </button>
        <button
          role="tab"
          aria-selected={tab === "friends"}
          className={tab === "friends" ? "active" : ""}
          onClick={() => {
            setTab("friends");
            void load();
          }}
        >
          Mes amis ({mine.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === "requests"}
          className={tab === "requests" ? "active" : ""}
          onClick={() => {
            setTab("requests");
            void load();
          }}
        >
          Demandes ({incoming.length})
        </button>
      </div>
      {tab === "players" && (
        <>
          <div className="search player-search">
            <Search />
            <input
              aria-label="Rechercher un pseudo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un pseudo…"
            />
          </div>
          {data.players.map(playerRow)}
          {!loading && !data.players.length && !error && (
            <p className="empty-real">
              {query ? "Aucun pseudo trouvé." : "Aucun autre joueur inscrit pour le moment."}
            </p>
          )}
          {data.nextOffset !== null && (
            <button
              className="friends-more"
              disabled={loading}
              onClick={() => void load(data.nextOffset ?? 0)}
            >
              {loading ? "Chargement…" : "Voir plus de joueurs"}
            </button>
          )}
        </>
      )}
      {tab === "friends" && (
        <>
          {(profileLoading || selectedFriend || profileError) && (
            <section className="friend-profile-detail" aria-label="Profil de l’ami">
              {profileLoading && <p>Chargement du profil…</p>}
              {profileError && <p role="alert">{profileError}</p>}
              {selectedFriend && (
                <>
                  <div className="friend-profile-heading">
                    <h3>Profil de {selectedFriend.username}</h3>
                    <button
                      className="subtle"
                      onClick={() => setSelectedFriend(null)}
                      aria-label="Fermer le profil"
                    >
                      <X /> Fermer
                    </button>
                  </div>
                  <ProfileCardDisplay
                    username={selectedFriend.username}
                    stats={selectedFriend}
                    look={selectedFriend}
                  />
                </>
              )}
            </section>
          )}
          {!mine.length && (
            <p className="empty-real">
              Vous n’avez pas encore d’amis. Ajoutez un joueur depuis « Tous les joueurs ».
            </p>
          )}
          {mine.map((row) => (
            <div className="friend player-entry" key={row.id}>
              {avatar(row)}
              <div>
                <b>{row.username}</b>
                <small>Ami Sudoku Clash</small>
              </div>
              <button onClick={() => void showProfile(row.otherUserId)}>Voir profil</button>
              <button
                onClick={() =>
                  onChallenge
                    ? onChallenge({ id: row.otherUserId, username: row.username })
                    : notify(`Invitez ${row.username} avec le code de votre salon privé`)
                }
              >
                <Swords />
                Défier
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "requests" && (
        <>
          {!incoming.length && !outgoing.length && (
            <p className="empty-real">Aucune demande en cours.</p>
          )}
          {incoming.map((row) => (
            <div className="friend player-entry" key={row.id}>
              {avatar(row)}
              <div>
                <b>{row.username}</b>
                <small>Souhaite devenir votre ami</small>
              </div>
              <button
                disabled={busy !== null}
                onClick={() => void action({ action: "accept", id: row.id }, row.id)}
              >
                <Check />
                Accepter
              </button>
              <button
                className="subtle"
                disabled={busy !== null}
                onClick={() => void action({ action: "decline", id: row.id }, row.id)}
              >
                <X />
                Refuser
              </button>
            </div>
          ))}
          {outgoing.map((row) => (
            <div className="friend player-entry" key={row.id}>
              {avatar(row)}
              <div>
                <b>{row.username}</b>
                <small>En attente de réponse</small>
              </div>
            </div>
          ))}
        </>
      )}
      {loading && <p className="empty-real">Chargement des joueurs…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button className="friends-retry" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      )}
    </div>
  );
}
