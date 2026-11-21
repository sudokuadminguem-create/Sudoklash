"use client";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { pseudonymClass } from "@/app/lib/pseudonym";
import { useI18n } from "@/app/lib/i18n";
import { FriendDuel } from "./friend-duel";
import { ModePanel } from "./mode-panel";
import { PlayerAvatar } from "./player-cosmetics";
import { RankedGame } from "./ranked-game";
import { RankedMatch } from "./ranked-match";
import { Tournaments, type useTournaments } from "./tournaments";

// The home screen's play area: the account card, the guest invitation and the chosen mode.

export function HomeAccountButton({
  account,
  cosmetics,
  onClick,
}: Readonly<{
  account: Account;
  cosmetics: Cosmetics;
  onClick: () => void;
}>) {
  const { t } = useI18n();
  const signedIn = !!account.user;
  return (
    <button
      className="rank-card beta-account home-account-button"
      onClick={onClick}
      aria-label={signedIn ? t("home.accountSignedIn") : t("home.accountSignedOut")}
    >
      <PlayerAvatar
        avatarId={cosmetics.state?.avatarId}
        image={cosmetics.state?.customAvatar}
        frameId={cosmetics.state?.frameId}
        size="large"
        fallback={signedIn ? undefined : "?"}
      />
      <span className="home-account-text">
        <small>
          {t("home.myAccount")} ·{" "}
          {signedIn
            ? t("home.level", { level: cosmetics.state?.level ?? 1 })
            : t("home.notConnected")}
        </small>
        <b className={pseudonymClass(account.profile?.usernameColor)}>
          {account.profile?.username || t("home.chooseAvatar")}
        </b>
        <span>{signedIn ? t("home.viewProfile") : t("home.signInToCustomize")}</span>
      </span>
    </button>
  );
}

/** Invites a guest to the daily challenge, or to sign up once they are looking at it. */
export function GuestDailyInvite({
  fr,
  daily,
  onDiscover,
  onSignup,
}: Readonly<{
  fr: boolean;
  daily: boolean;
  onDiscover: () => void;
  onSignup: () => void;
}>) {
  if (daily)
    return (
      <aside className="panel daily-invite">
        <div>
          <h3>{fr ? "Débloque le défi du jour" : "Unlock the daily challenge"}</h3>
          <p>
            {fr
              ? "Un compte gratuit suffit pour jouer et enregistrer ton score."
              : "Create a free account to play and save your score."}
          </p>
        </div>
        <button type="button" className="primary" onClick={onSignup}>
          {fr ? "Créer un compte gratuit" : "Create a free account"}
        </button>
      </aside>
    );
  return (
    <aside
      className="panel daily-invite"
      aria-label={fr ? "Découvrir le défi du jour" : "Discover the daily challenge"}
    >
      <div>
        <h3>{fr ? "À toi de jouer : le défi du jour" : "Try today’s challenge"}</h3>
        <p>
          {fr
            ? "Crée un compte gratuit pour jouer la grille du jour et comparer ton temps."
            : "Create a free account to play today’s puzzle and compare your time."}
        </p>
      </div>
      <button type="button" className="primary" onClick={onDiscover}>
        {fr ? "Voir la grille du jour" : "See today’s puzzle"}
      </button>
    </aside>
  );
}

type DuelTarget = { id: string; username: string } | null;

/** The game area of the mode picked in the home tabs. */
export function PlayModeContent({
  mode,
  account,
  cosmetics,
  notify,
  openAuth,
  tournaments,
  duelTarget,
  onDuelTargetUsed,
}: Readonly<{
  mode: string;
  account: Account;
  cosmetics: Cosmetics;
  notify: (message: string) => void;
  openAuth: () => void;
  tournaments: {
    feed: ReturnType<typeof useTournaments>;
    id: string | null;
    onOpen: (id?: string) => void;
  };
  duelTarget: DuelTarget;
  onDuelTargetUsed: () => void;
}>) {
  if (mode === "tournaments")
    return (
      <Tournaments
        key={account.user?.id ?? "guest"}
        feed={tournaments.feed}
        id={tournaments.id}
        onOpen={tournaments.onOpen}
        userId={account.user?.id}
        coins={cosmetics.state?.coins}
        openAuth={openAuth}
        walletRefresh={() => void cosmetics.refresh()}
      />
    );
  if (mode === "classée")
    return (
      <RankedMatch
        account={account}
        cosmetics={cosmetics}
        openAuth={openAuth}
        renderGame={(match, refresh) => (
          <RankedGame match={match} refresh={refresh} account={account} />
        )}
      />
    );
  if (mode === "duel")
    return (
      <FriendDuel
        account={account}
        openAuth={openAuth}
        notify={notify}
        target={duelTarget}
        onTargetUsed={onDuelTargetUsed}
      />
    );
  const panelKey = mode === "daily" ? (account.user?.id ?? "daily-guest") : "other-modes";
  return (
    <ModePanel
      key={panelKey}
      mode={mode}
      notify={notify}
      account={account}
      cosmetics={cosmetics}
      openAuth={openAuth}
    />
  );
}
