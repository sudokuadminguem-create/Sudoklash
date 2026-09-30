"use client";
import type { Account } from "@/hooks/use-account";
import FriendsDirectory from "./friends-directory";
import { LockedPanel } from "./locked-panel";

export function RealFriends({
  account,
  notify,
  openAuth,
  onChallenge,
  requestFocus,
}: {
  account: Account;
  notify: (s: string) => void;
  openAuth: () => void;
  onChallenge?: (friend: { id: string; username: string }) => void;
  requestFocus?: number;
}) {
  if (!account.user)
    return (
      <LockedPanel
        title="Retrouvez vos amis"
        text="Connectez-vous pour choisir un pseudo unique, ajouter des amis et les défier."
        action={openAuth}
      />
    );
  return (
    <FriendsDirectory
      account={account}
      notify={notify}
      onChallenge={onChallenge}
      requestFocus={requestFocus}
    />
  );
}
