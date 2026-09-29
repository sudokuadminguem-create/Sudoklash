"use client";
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
import { AccountButton } from "./_components/account-button";
import { AchievementBoard } from "./_components/achievement-board";
import { ChallengeAnnouncer } from "./_components/challenge-announcer";
import { AccountOverview } from "./_components/account-overview";
import { AuthDialog } from "./_components/auth-dialog";
import { Leaderboard } from "./_components/leaderboard";
import { ModePanel } from "./_components/mode-panel";
import { PlayerAvatar } from "./_components/player-cosmetics";
import { RankedGame } from "./_components/ranked-game";
import { RankedMatch } from "./_components/ranked-match";
import { FriendDuel } from "./_components/friend-duel";
import { RealFriends } from "./_components/real-friends";
import { useDuelInvites } from "./lib/use-duel-invites";
import { SettingsPanel } from "./_components/settings-panel";
import { Shop } from "./_components/shop";
import { authHeaders } from "./lib/auth-headers";
import { I18nProvider, useI18n } from "./lib/i18n";
import type { MessageKey } from "./lib/i18n-core";
import { SettingsProvider } from "./lib/settings";
import { supabase } from "./lib/supabase";
import { useAccount } from "@/hooks/use-account";
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

function HomeContent() {
  const { t } = useI18n();
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
    [recovery, setRecovery] = useState(false),
    [recoveryStatus, setRecoveryStatus] = useState<"checking" | "ready" | "expired">("checking");
  const account = useAccount();
  const cosmetics = useCosmetics(account);
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
      <main
        className="shell"
        style={
          {
            "--grid-one": activeTheme.colors[0],
            "--grid-two": activeTheme.colors[1],
          } as CSSProperties
        }
      >
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
              <AccountButton
                account={account}
                cosmetics={cosmetics}
                onAccount={() => setView("compte")}
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
                  <button
                    className="rank-card beta-account home-account-button"
                    onClick={() => (account.user ? setView("compte") : setAuthOpen(true))}
                    aria-label={
                      account.user ? t("home.accountSignedIn") : t("home.accountSignedOut")
                    }
                  >
                    <PlayerAvatar
                      avatarId={cosmetics.state?.avatarId}
                      image={cosmetics.state?.customAvatar}
                      frameId={cosmetics.state?.frameId}
                      size="large"
                      fallback={account.user ? undefined : "?"}
                    />
                    <span className="home-account-text">
                      <small>
                        {t("home.myAccount")} ·{" "}
                        {account.user
                          ? t("home.level", { level: cosmetics.state?.level ?? 1 })
                          : t("home.notConnected")}
                      </small>
                      <b>{account.profile?.username || t("home.chooseAvatar")}</b>
                      <span>
                        {account.user ? t("home.viewProfile") : t("home.signInToCustomize")}
                      </span>
                    </span>
                  </button>
                </section>
                <div className="mode-tabs">
                  {modeTabs.map(([id, label, I]) => (
                    <button
                      key={id}
                      onClick={() => setMode(id)}
                      className={mode === id ? "active" : ""}
                    >
                      <I />
                      {t(label)}
                      {id === "hebdo" && <small>+500</small>}
                      {id === "duel" && duelInvites > 0 && <small>{duelInvites}</small>}
                    </button>
                  ))}
                </div>
                {mode === "classée" ? (
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
            {view === "parametres" && <SettingsPanel notify={notify} />}
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
          </div>
        )}
        {authOpen && (
          <AuthDialog
            account={account}
            recovery={recovery}
            recoveryStatus={recoveryStatus}
            onRecovered={() => {
              setRecovery(false);
              window.history.replaceState({}, "", window.location.pathname);
              setAuthOpen(false);
              notify("Mot de passe mis à jour");
            }}
            onClose={() => setAuthOpen(false)}
          />
        )}
      </main>
    </SettingsProvider>
  );
}
