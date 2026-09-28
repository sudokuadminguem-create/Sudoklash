"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CalendarDays,
  Check,
  Coins,
  Flame,
  Gamepad2,
  Medal,
  LockKeyhole,
  Menu,
  Swords,
  Trophy,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import "./sudoku-grid.css";
import { AccountButton } from "./_components/account-button";
import { AchievementBoard } from "./_components/achievement-board";
import { AccountOverview } from "./_components/account-overview";
import { AuthDialog } from "./_components/auth-dialog";
import { Leaderboard } from "./_components/leaderboard";
import { ModePanel } from "./_components/mode-panel";
import { PlayerAvatar } from "./_components/player-cosmetics";
import { RankedGame } from "./_components/ranked-game";
import { RankedMatch } from "./_components/ranked-match";
import { RealFriends } from "./_components/real-friends";
import { Shop } from "./_components/shop";
import { authHeaders } from "./lib/auth-headers";
import { supabase } from "./lib/supabase";
import { useAccount } from "@/hooks/use-account";
import { useCosmetics } from "@/hooks/use-cosmetics";
import { gridThemes } from "@/lib/cosmetics";

type View = "jouer" | "compte" | "classement" | "amis" | "boutique" | "defis";
const nav = [
  ["jouer", "Jouer", Gamepad2],
  ["defis", "Défis", Medal],
  ["classement", "Classement", Trophy],
  ["amis", "Amis", Users],
  ["compte", "Compte", UserRound],
  ["boutique", "Boutique", Coins],
] as const;
const modeTabs = [
  ["classée", "Partie classée", Swords],
  ["solo", "Solo", Zap],
  ["daily", "Grille du jour", CalendarDays],
  ["hebdo", "Grille hebdo", Flame],
  ["privée", "Salon privé", Users],
] as const;

export default function Home() {
  const [view, setView] = useState<View>("jouer"),
    [mode, setMode] = useState("solo"),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [me, setMe] = useState<{ signedIn: boolean; isAdmin: boolean; displayName: string | null }>({
      signedIn: false,
      isAdmin: false,
      displayName: null,
    }),
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
    title = useMemo(
      () =>
        ({
          jouer: "Centre de jeu",
          compte: "Mon compte",
          classement: "Classement mondial",
          amis: "Amis",
          boutique: "Boutique cosmétique",
          defis: "Défis",
        })[view],
      [view],
    );
  const activeTheme = gridThemes.find((t) => t.id === cosmetics.state?.themeId) ?? gridThemes[0];
  return (
    <main
      className="shell"
      style={
        {
          "--grid-one": activeTheme.colors[0],
          "--grid-two": activeTheme.colors[1],
        } as CSSProperties
      }
    >
      <aside id="main-menu" className={mobile ? "side open" : "side"}>
        <div className="brand">
          <div className="brandmark">9</div>
          <div>
            SUDOKU <b>CLASH</b>
          </div>
          <button className="close" aria-label="Fermer le menu" onClick={() => setMobile(false)}>
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
              <span>{label}</span>
            </button>
          ))}
          {me.isAdmin && (
            <a className="admin-link" href="/admin">
              <LockKeyhole />
              <span>Administration</span>
            </a>
          )}
        </nav>
        <div className="season">
          <span>BÊTA PUBLIQUE</span>
          <b>Comptes et salons en ligne</b>
          <div>
            <i style={{ width: "100%" }} />
          </div>
          <small>Progression enregistrée et protégée</small>
        </div>
      </aside>
      <button
        className={mobile ? "scrim show" : "scrim"}
        aria-label="Fermer le menu"
        tabIndex={mobile ? 0 : -1}
        onClick={() => setMobile(false)}
      />
      <section className="app">
        <header>
          <button
            className="menub"
            aria-label="Ouvrir le menu"
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
        <div className="content">
          {view === "jouer" && (
            <>
              <section className="welcome">
                <div>
                  <span className="live">
                    <i />
                    BÊTA PUBLIQUE · COMPTES RÉELS
                  </span>
                  <h2>Prêt pour le prochain clash ?</h2>
                  <p>Joue en solo, trouve un duel classé ou crée un salon privé.</p>
                </div>
                <button
                  className="rank-card beta-account home-account-button"
                  onClick={() => (account.user ? setView("compte") : setAuthOpen(true))}
                  aria-label={
                    account.user
                      ? "Voir mon compte et personnaliser mon avatar"
                      : "Se connecter au compte"
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
                      MON COMPTE ·{" "}
                      {account.user ? `NIVEAU ${cosmetics.state?.level ?? 1}` : "NON CONNECTÉ"}
                    </small>
                    <b>{account.profile?.username || "Choisir mon avatar"}</b>
                    <span>
                      {account.user
                        ? "Voir le profil et les cadres"
                        : "Se connecter pour personnaliser"}
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
                    {label}
                    {id === "hebdo" && <small>+500</small>}
                  </button>
                ))}
              </div>
              {mode === "classée" ? (
                <RankedMatch
                  account={account}
                  openAuth={() => setAuthOpen(true)}
                  renderGame={(match, refresh) => (
                    <RankedGame match={match} refresh={refresh} account={account} />
                  )}
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
            <RealFriends account={account} notify={notify} openAuth={() => setAuthOpen(true)} />
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
        <div className="toast">
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
  );
}
