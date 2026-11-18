"use client";
import { PremiumEffectProvider } from "./_components/premium-effects";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CalendarDays,
  Check,
  Coins,
  Flame,
  Gamepad2,
  Handshake,
  Medal,
  LockKeyhole,
  Menu,
  Settings,
  Swords,
  Trophy,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./sudoku-grid.css";
import "./hint-techniques.css";
import "./mobile.css";
import "./i18n.css";
import "./pwa.css";
import { WalletBalances } from "./_components/wallet-balances";
import { AccountButton } from "./_components/account-button";
import { AchievementBoard } from "./_components/achievement-board";
import { ChallengeAnnouncer } from "./_components/challenge-announcer";
import { AccountOverview } from "./_components/account-overview";
import { AuthDialog } from "./_components/auth-dialog";
import { Leaderboard } from "./_components/leaderboard";
import { SupportPodium } from "./_components/support";
import { TournamentBanner, Tournaments, useTournaments } from "./_components/tournaments";
import { ModePanel } from "./_components/mode-panel";
import { PlayerAvatar } from "./_components/player-cosmetics";
import { RankedGame } from "./_components/ranked-game";
import { RankedMatch } from "./_components/ranked-match";
import { FriendDuel } from "./_components/friend-duel";
import { RealFriends } from "./_components/real-friends";
import { useDuelInvites } from "./lib/use-duel-invites";
import { PwaStatus } from "./_components/pwa-status";
import { SettingsPanel } from "./_components/settings-panel";
import { Shop } from "./_components/shop";
import { authHeaders } from "./lib/auth-headers";
import { I18nProvider, useI18n } from "./lib/i18n";
import type { MessageKey } from "./lib/i18n-core";
import { SettingsProvider } from "./lib/settings";
import { supabase } from "./lib/supabase";
import { useAccount } from "@/hooks/use-account";
import { useLivePresence } from "@/hooks/use-live-presence";
import { useCosmetics } from "@/hooks/use-cosmetics";
import { gridThemes } from "@/lib/cosmetics";

type View = "jouer" | "compte" | "classement" | "amis" | "boutique" | "defis" | "parametres";
const nav = [
  ["jouer", "nav.play", Gamepad2],
  ["defis", "nav.challenges", Medal],
  ["classement", "nav.ranking", Trophy],
  ["amis", "nav.friends", Users],
  ["compte", "nav.account", UserRound],
  ["boutique", "nav.shop", Coins],
  ["parametres", "nav.settings", Settings],
] as const satisfies readonly (readonly [View, MessageKey, unknown])[];
const modeTabs = [
  ["classée", "mode.ranked", Swords],
  ["solo", "mode.solo", Zap],
  ["daily", "mode.daily", CalendarDays],
  ["tournaments", "mode.tournaments", Trophy],
  ["hebdo", "mode.weekly", Flame],
  ["duel", "mode.duel", Handshake],
  ["privée", "mode.lobby", Users],
] as const satisfies readonly (readonly [string, MessageKey, unknown])[];
const titleKeys: Record<View, MessageKey> = {
  jouer: "title.play",
  compte: "title.account",
  classement: "title.ranking",
  amis: "title.friends",
  boutique: "title.shop",
  defis: "title.challenges",
  parametres: "title.settings",
};

export default function Home() {
  return (
    <I18nProvider>
      <HomeContent />
    </I18nProvider>
  );
}

function HomeAccountButton({
  account,
  cosmetics,
  onClick,
}: {
  account: ReturnType<typeof useAccount>;
  cosmetics: ReturnType<typeof useCosmetics>;
  onClick: () => void;
}) {
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
        <b>{account.profile?.username || t("home.chooseAvatar")}</b>
        <span>{signedIn ? t("home.viewProfile") : t("home.signInToCustomize")}</span>
      </span>
    </button>
  );
}

/** Invites a guest to the daily challenge, or to sign up once they are looking at it. */
function GuestDailyInvite({
  fr,
  daily,
  onDiscover,
  onSignup,
}: {
  fr: boolean;
  daily: boolean;
  onDiscover: () => void;
  onSignup: () => void;
}) {
  if (daily)
    return (
      <aside className="panel daily-invite">
        <div>
          <h3>{fr ? "Débloque le défi du jour" : "Unlock the daily challenge"}</h3>
          <p>{fr ? "Un compte gratuit suffit pour jouer et enregistrer ton score." : "Create a free account to play and save your score."}</p>
        </div>
        <button type="button" className="primary" onClick={onSignup}>
          {fr ? "Créer un compte gratuit" : "Create a free account"}
        </button>
      </aside>
    );
  return (
    <aside className="panel daily-invite" aria-label={fr ? "Découvrir le défi du jour" : "Discover the daily challenge"}>
      <div>
        <h3>{fr ? "À toi de jouer : le défi du jour" : "Try today’s challenge"}</h3>
        <p>{fr ? "Crée un compte gratuit pour jouer la grille du jour et comparer ton temps." : "Create a free account to play today’s puzzle and compare your time."}</p>
      </div>
      <button type="button" className="primary" onClick={onDiscover}>
        {fr ? "Voir la grille du jour" : "See today’s puzzle"}
      </button>
    </aside>
  );
}

function HomeContent() {
  const { t, locale } = useI18n();
  const onlineCount = useLivePresence();
  const tournamentFeed = useTournaments();
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const openTournament = (id?:string) => { setTournamentId(id ?? null); setMode("tournaments"); };
  const fr = locale === "fr";
  const [view, setView] = useState<View>("jouer"),
    [mode, setMode] = useState("solo"),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [me, setMe] = useState<{ signedIn: boolean; isAdmin: boolean; displayName: string | null }>({
      signedIn: false,
      isAdmin: false,
      displayName: null,
    }),
    // A friend picked in the friends list, waiting to be challenged on the duel screen.
    [duelTarget, setDuelTarget] = useState<{ id: string; username: string } | null>(null),
    [authOpen, setAuthOpen] = useState(false),
    [startSignup, setStartSignup] = useState(false),
    [editPhoto, setEditPhoto] = useState(false),
    [friendRequestFocus, setFriendRequestFocus] = useState(0),
    [recovery, setRecovery] = useState(false),
    [recoveryStatus, setRecoveryStatus] = useState<"checking" | "ready" | "expired">("checking");
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.has("premium_session") || query.has("premium_cancelled") || query.has("support_session") || query.has("support_cancelled")) setView("boutique");
  }, []);
  const account = useAccount();
  const cosmetics = useCosmetics(account);
  useEffect(() => {
    if (!editPhoto || view !== "compte" || !cosmetics.state) return;
    const editor = document.getElementById("profile-photo-editor");
    if (!editor) return;
    editor.scrollIntoView({ block: "center" });
    editor.querySelector<HTMLInputElement>("input[type=file]")?.focus({ preventScroll: true });
    setEditPhoto(false);
  }, [editPhoto, view, cosmetics.state]);
  useEffect(() => {
    if (account.user && (view === "compte" || view === "boutique" || view === "defis"))
      void cosmetics.refresh();
  }, [view, account.user?.id]);
  useEffect(() => {
    document.body.classList.toggle("menu-open", mobile);
    return () => document.body.classList.remove("menu-open");
  }, [mobile]);
  useEffect(() => {
    if (account.loading) return;
    let active = true;
    authHeaders()
      .then((headers) => fetch("/api/me", { cache: "no-store", headers }))
      .then(
        (response) =>
          response.json() as Promise<{
            signedIn: boolean;
            isAdmin: boolean;
            displayName: string | null;
          }>,
      )
      .then((value) => {
        if (active) setMe(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [account.loading, account.user?.id]);
  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") === "1") {
      setRecovery(true);
      setAuthOpen(true);
      if (url.searchParams.has("error") || new URLSearchParams(url.hash.slice(1)).has("error"))
        setRecoveryStatus("expired");
      else
        void supabase.auth
          .getSession()
          .then(({ data, error }) => {
            if (active) setRecoveryStatus(!error && data.session ? "ready" : "expired");
          })
          .catch(() => {
            if (active) setRecoveryStatus("expired");
          });
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecovery(true);
        setRecoveryStatus("ready");
        setAuthOpen(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (account.user && !account.loading && !account.profile?.username && !recovery) {
      const timer = setTimeout(() => setAuthOpen(true), 0);
      return () => clearTimeout(timer);
    }
  }, [account.user, account.loading, account.profile?.username, recovery]);
  const notify = (s: string) => {
      setToast(s);
      setTimeout(() => setToast(""), 2400);
    },
    title = t(titleKeys[view]);
  const duelInvites = useDuelInvites(account.user?.id, (from) =>
    notify(t("shell.duelInvite", { from })),
  );
  const activeTheme = gridThemes.find((t) => t.id === cosmetics.state?.themeId) ?? gridThemes[0];
  return (
    <SettingsProvider>
      <PremiumEffectProvider effectId={cosmetics.state?.victoryEffectId ?? "none"}>
        <main
          className="shell"
          style={
            {
              "--grid-one": activeTheme.colors[0],
              "--grid-two": activeTheme.colors[1],
            } as CSSProperties
          }
        >
          <PwaStatus />
          <ChallengeAnnouncer
            account={account}
            cosmetics={cosmetics}
            onDiscover={() => {
              setView("defis");
              void cosmetics.refresh();
            }}
          />
          <a className="skip-link" href="#contenu">
            {t("shell.skip")}
          </a>
          <aside id="main-menu" className={mobile ? "side open" : "side"}>
            <div className="brand">
              <div className="brandmark">9</div>
              <div>
                SUDOKU <b>CLASH</b>
              </div>
              <button
                className="close"
                aria-label={t("shell.menuClose")}
                onClick={() => setMobile(false)}
              >
                <X />
              </button>
            </div>
            <nav>
              {nav.map(([id, label, I]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => {
                    setView(id);
                    setMobile(false);
                  }}
                >
                  <I />
                  <span>{t(label)}</span>
                </button>
              ))}
              {me.isAdmin && (
                <a className="admin-link" href="/admin">
                  <LockKeyhole />
                  <span>{t("shell.admin")}</span>
                </a>
              )}
            </nav>
            <div className="season">
              <span>{t("shell.beta")}</span>
              <b>{t("shell.betaTitle")}</b>
              <div>
                <i style={{ width: "100%" }} />
              </div>
              <small>{t("shell.betaNote")}</small>
            </div>
          </aside>
          <button
            className={mobile ? "scrim show" : "scrim"}
            aria-label={t("shell.menuClose")}
            tabIndex={mobile ? 0 : -1}
            onClick={() => setMobile(false)}
          />
          <section className="app">
            <header>
              <button
                className="menub"
                aria-label={t("shell.menuOpen")}
                aria-expanded={mobile}
                aria-controls="main-menu"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </button>
              <div className="page-title">
                <span className="crumb">SUDOKU CLASH /</span>
                <h1>{title}</h1>
              </div>
              <div className="header-actions">
                {account.user && !account.loading && (
                  <WalletBalances coins={cosmetics.state?.coins} gems={cosmetics.state?.gems} locale={locale} openShop={() => setView("boutique")} />
                )}
                <AccountButton
                  key={account.user?.id ?? "guest"}
                  account={account}
                  cosmetics={cosmetics}
                  onAccount={() => setView("compte")}
                  onFriends={() => {
                    setFriendRequestFocus((value) => value + 1);
                    setView("amis");
                  }}
                  onDuels={() => {
                    setMode("duel");
                    setView("jouer");
                  }}
                  onEditPhoto={() => {
                    setEditPhoto(true);
                    setView("compte");
                  }}
                  onOpen={() => setAuthOpen(true)}
                />
              </div>
            </header>
            <div className="content" id="contenu" tabIndex={-1}>
              {view === "jouer" && (
                <>
                  <section className="welcome">
                    <div>
                      <span className="live">
                        <i />
                        {t("home.live")}
                      </span>
                      <h2>{t("home.title")}</h2>
                      <p>{t("home.lead")}</p>
                    </div>
                    <HomeAccountButton
                      account={account}
                      cosmetics={cosmetics}
                      onClick={() => (account.user ? setView("compte") : setAuthOpen(true))}
                    />
                  </section>
                  {!account.loading && !account.user && (
                    <GuestDailyInvite
                      fr={fr}
                      daily={mode === "daily"}
                      onDiscover={() => setMode("daily")}
                      onSignup={() => {
                        setStartSignup(true);
                        setAuthOpen(true);
                      }}
                    />
                  )}
                  <SupportPodium />
                  <TournamentBanner feed={tournamentFeed} onOpen={openTournament} />
                  <div className="mode-tabs">
                    {modeTabs.map(([id, label, I]) => (
                      <button
                        key={id}
                        onClick={() => id === "tournaments" ? openTournament() : setMode(id)}
                        aria-pressed={mode === id}
                        className={mode === id ? "active" : ""}
                      >
                        <I />
                        {id === "classée" ? <span className="ranked-tab-copy">{t(label)}<span className="ranked-online">{onlineCount === null ? "—" : new Intl.NumberFormat(locale).format(onlineCount)} {fr ? "en ligne" : "online"}</span></span> : t(label)}
                        {id === "duel" && duelInvites > 0 && <small>{duelInvites}</small>}
                      </button>
                    ))}
                  </div>
                  {mode === "tournaments" ? (
                    <Tournaments key={account.user?.id ?? "guest"} feed={tournamentFeed} id={tournamentId} onOpen={openTournament} userId={account.user?.id} coins={cosmetics.state?.coins} openAuth={() => setAuthOpen(true)} walletRefresh={() => void cosmetics.refresh()} />
                  ) : mode === "classée" ? (
                    <RankedMatch
                      account={account}
                      cosmetics={cosmetics}
                      openAuth={() => setAuthOpen(true)}
                      renderGame={(match, refresh) => (
                        <RankedGame match={match} refresh={refresh} account={account} />
                      )}
                    />
                  ) : mode === "duel" ? (
                    <FriendDuel
                      account={account}
                      openAuth={() => setAuthOpen(true)}
                      notify={notify}
                      target={duelTarget}
                      onTargetUsed={() => setDuelTarget(null)}
                    />
                  ) : (
                    <ModePanel
                      key={mode === "daily" ? account.user?.id ?? "daily-guest" : "other-modes"}
                      mode={mode}
                      notify={notify}
                      account={account}
                      cosmetics={cosmetics}
                      openAuth={() => setAuthOpen(true)}
                    />
                  )}
                </>
              )}
              {view === "compte" && (
                <AccountOverview
                  account={account}
                  cosmetics={cosmetics}
                  notify={notify}
                  openAuth={() => setAuthOpen(true)}
                />
              )}
              {view === "defis" && (
                <AchievementBoard
                  account={account}
                  cosmetics={cosmetics}
                  notify={notify}
                  openAuth={() => setAuthOpen(true)}
                />
              )}
              {view === "classement" && <Leaderboard />}
              {view === "amis" && (
                <RealFriends
                  requestFocus={friendRequestFocus}
                  account={account}
                  notify={notify}
                  openAuth={() => setAuthOpen(true)}
                  onChallenge={(friend) => {
                    setDuelTarget(friend);
                    setMode("duel");
                    setView("jouer");
                  }}
                />
              )}
              {view === "parametres" && (
                <SettingsPanel
                  notify={notify}
                  account={account}
                  openAuth={() => setAuthOpen(true)}
                />
              )}
              {view === "boutique" && (
                <Shop
                  notify={notify}
                  cosmetics={cosmetics}
                  account={account}
                  openAuth={() => setAuthOpen(true)}
                />
              )}
            </div>
          </section>
          {toast && (
            <div className="toast" role="status" aria-live="polite">
              <Check />
              {toast}
              <button type="button" className="toast-close" aria-label={fr ? "Fermer la notification" : "Dismiss notification"} onClick={() => setToast("")}><X aria-hidden="true" /></button>
            </div>
          )}
          {authOpen && (
            <AuthDialog
              account={account}
              startSignup={startSignup}
              recovery={recovery}
              recoveryStatus={recoveryStatus}
              onRecovered={() => {
                setRecovery(false);
                window.history.replaceState({}, "", window.location.pathname);
                setAuthOpen(false);
                notify("Mot de passe mis à jour");
              }}
              onClose={() => { setStartSignup(false); setAuthOpen(false); }}
            />
          )}
        </main>
      </PremiumEffectProvider>
    </SettingsProvider>
  );
}
