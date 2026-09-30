"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, LogOut, UserRound, UserPlus, Swords, Bell } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { useI18n } from "@/app/lib/i18n";
import { usePlayerAppearances } from "@/app/lib/use-player-appearances";
import { supabase } from "@/app/lib/supabase";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { PlayerAvatar } from "./player-cosmetics";
import "../profile-menu.css";

type Notice = { id: string; playerId: string; name: string; kind: "friend" | "duel" };

export function AccountButton({
  account,
  onOpen,
  onAccount,
  cosmetics,
  onFriends,
  onDuels,
  onEditPhoto,
}: {
  account: Account;
  onOpen: () => void;
  onAccount: () => void;
  cosmetics: Cosmetics;
  onFriends: () => void;
  onDuels: () => void;
  onEditPhoto: () => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [notices, setNotices] = useState<Notice[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const userId = account.user?.id;
  const appearances = usePlayerAppearances(notices.map((notice) => notice.playerId));
  useEffect(() => {
    if (!userId) return;
    let live = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const headers = await authHeaders();
        const responses = await Promise.all([
          fetch("/api/friends", { headers, cache: "no-store" }),
          fetch("/api/duels", { headers, cache: "no-store" }),
        ]);
        if (responses.some((response) => !response.ok)) throw new Error("notifications");
        const [friends, duels] = (await Promise.all(
          responses.map((response) => response.json()),
        )) as [
          {
            relationships: {
              id: string;
              otherUserId: string;
              username: string;
              status: string;
              addressee_id: string;
            }[];
          },
          { incoming: { id: string; from: { id: string; username: string } }[] },
        ];
        if (live) {
          setNotices([
            ...friends.relationships
              .filter((row) => row.status === "pending" && row.addressee_id === userId)
              .map((row) => ({
                id: row.id,
                playerId: row.otherUserId,
                name: row.username,
                kind: "friend" as const,
              })),
            ...duels.incoming.map((row) => ({
              id: row.id,
              playerId: row.from.id,
              name: row.from.username,
              kind: "duel" as const,
            })),
          ]);
          setError(false);
        }
      } catch {
        if (live) setError(true);
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [userId, open]);
  const navigate = (action: () => void) => {
    popup.current?.hidePopover();
    action();
  };
  if (account.loading)
    return (
      <div className="profile">
        <div className="avatar">…</div>
      </div>
    );
  if (!account.user)
    return (
      <button
        className="profile signin account-trigger account-orb"
        onClick={onOpen}
        aria-label="Se connecter"
      >
        <span className="avatar">?</span>
      </button>
    );
  const level = cosmetics.state?.level ?? 1;
  return (
    <div className="profile profile-menu-host">
      <div className="profile-photo-control">
        <button
          className="profile-account-link account-orb"
          popoverTarget={id}
          aria-expanded={open}
          aria-controls={id}
          aria-label={
            en
              ? `Open profile and notifications, ${notices.length} pending`
              : `Ouvrir le profil et les notifications, ${notices.length} en attente`
          }
        >
          <PlayerAvatar
            avatarId={cosmetics.state?.avatarId}
            image={cosmetics.state?.customAvatar}
            frameId={cosmetics.state?.frameId}
          />
          <span className="orb-level" aria-hidden="true">
            Niv. {level}
          </span>
          {notices.length > 0 && (
            <span className="profile-notice-count" aria-hidden="true">
              {notices.length > 99 ? "99+" : notices.length}
            </span>
          )}
        </button>
        <button
          className="profile-photo-edit"
          onClick={() => navigate(onEditPhoto)}
          aria-label={en ? "Change profile photo" : "Changer la photo de profil"}
          title={en ? "Change photo" : "Changer la photo"}
        >
          <Camera aria-hidden="true" />
        </button>
      </div>
      <div
        ref={popup}
        id={id}
        popover="auto"
        className="profile-dropdown"
        onToggle={(event) => setOpen(event.newState === "open")}
      >
        <div className="profile-dropdown-heading">
          <Bell aria-hidden="true" />
          <h2>{en ? "Notifications" : "Notifications"}</h2>
        </div>
        {loading ? (
          <p role="status">{en ? "Loading…" : "Chargement…"}</p>
        ) : error ? (
          <p role="status">
            {en
              ? "Notifications temporarily unavailable."
              : "Notifications momentanément indisponibles."}
          </p>
        ) : !notices.length ? (
          <p>{en ? "No pending invitations." : "Aucune invitation en attente."}</p>
        ) : (
          <ul className="profile-notices">
            {notices.map((notice) => (
              <li key={`${notice.kind}:${notice.id}`}>
                <button onClick={() => navigate(notice.kind === "friend" ? onFriends : onDuels)}>
                  <PlayerAvatar
                    avatarId={appearances[notice.playerId]?.avatarId}
                    frameId={appearances[notice.playerId]?.frameId}
                    image={appearances[notice.playerId]?.image}
                    size="small"
                  />
                  <span>
                    <b>{notice.name}</b>
                    <small>
                      {notice.kind === "friend"
                        ? en
                          ? "Friend request · View"
                          : "Demande d’ami · Voir"
                        : en
                          ? "Duel invitation · View"
                          : "Invitation au duel · Voir"}
                    </small>
                  </span>
                  {notice.kind === "friend" ? (
                    <UserPlus aria-hidden="true" />
                  ) : (
                    <Swords aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="profile-menu-actions">
          <button onClick={() => navigate(onAccount)}>
            <UserRound aria-hidden="true" />
            {en ? "My account" : "Mon compte"}
          </button>
          <button onClick={() => navigate(onEditPhoto)}>
            <Camera aria-hidden="true" />
            {en ? "Change photo" : "Changer la photo"}
          </button>
        </div>
        <button
          className="logout"
          aria-label="Se déconnecter"
          onClick={() => {
            popup.current?.hidePopover();
            void supabase.auth.signOut();
          }}
        >
          <LogOut />
          {en ? "Sign out" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );
}
