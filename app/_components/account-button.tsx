"use client";
import { LogOut } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { PlayerAvatar } from "./player-cosmetics";

export function AccountButton({
  account,
  onOpen,
  onAccount,
  cosmetics,
}: {
  account: Account;
  onOpen: () => void;
  onAccount: () => void;
  cosmetics: Cosmetics;
}) {
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
    <div className="profile">
      <button
        className="profile-account-link account-orb"
        onClick={onAccount}
        aria-label={`Ouvrir mon compte, niveau ${level}`}
      >
        <PlayerAvatar
          avatarId={cosmetics.state?.avatarId}
          image={cosmetics.state?.customAvatar}
          frameId={cosmetics.state?.frameId}
        />
        <span className="orb-level" aria-hidden="true">
          Niv. {level}
        </span>
      </button>
      <button
        className="logout"
        aria-label="Se déconnecter"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut />
      </button>
    </div>
  );
}
