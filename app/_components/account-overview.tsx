"use client";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { formatClock } from "@/app/lib/format-time";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { CosmeticCloset, PlayerAvatar } from "./player-cosmetics";
import { PlayerStats, type SoloStats } from "./player-stats";
import { ProfileCardStudio } from "./profile-card";
import "../player-stats.css";

type AccountStats = SoloStats & {
  profile: { username: string; created_at: number } | null;
  solo: { games: number; best: number | null; total: number | null };
  daily: number;
  weekly: number;
  ranked: { points: number; wins: number; losses: number; rank: string };
  recent: { difficulty: string; elapsed_seconds: number; completed_at: number }[];
  bestByDifficulty: { difficulty: string; best: number }[];
};

export function AccountOverview({
  account,
  openAuth,
  cosmetics,
  notify,
}: {
  account: Account;
  openAuth: () => void;
  cosmetics: Cosmetics;
  notify: (message: string) => void;
}) {
  const [stats, setStats] = useState<AccountStats | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!account.user) return;
    let live = true;
    authHeaders()
      .then((headers) => fetch("/api/account", { headers, cache: "no-store" }))
      .then((response) => {
        if (!response.ok) throw new Error("stats_unavailable");
        return response.json() as Promise<AccountStats>;
      })
      .then((value) => {
        if (live) setStats(value);
      })
      .catch(() => {
        if (live) setError(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [account.user]);
  if (account.loading) return <div className="panel account-overview">Chargement du compte…</div>;
  if (!account.user)
    return (
      <div className="panel locked-real">
        <ShieldCheck />
        <h2>Votre compte Sudoku Clash</h2>
        <p>Connectez-vous pour retrouver votre profil et vos résultats.</p>
        <button className="primary" onClick={openAuth}>
          Se connecter ou créer un compte
        </button>
      </div>
    );
  const joined = stats?.profile?.created_at ?? Date.parse(account.user.created_at);
  return (
    <div className="account-overview">
      {(!stats || !cosmetics.state) && (
        <section className="panel account-identity">
          <PlayerAvatar
            avatarId={cosmetics.state?.avatarId}
            image={cosmetics.state?.customAvatar}
            frameId={cosmetics.state?.frameId}
            size="large"
          />
          <div>
            <span className="eyebrow">MON COMPTE</span>
            <h2>{stats?.profile?.username ?? account.profile?.username ?? "Pseudo à choisir"}</h2>
            <p>{account.user.email}</p>
            <small>Inscrit depuis le {new Date(joined).toLocaleDateString("fr-FR")}</small>
          </div>
        </section>
      )}
      {stats && cosmetics.state && (
        <ProfileCardStudio
          username={stats.profile?.username ?? account.profile?.username ?? "Joueur"}
          stats={stats}
          cosmetics={cosmetics}
          notify={notify}
        />
      )}
      {stats && cosmetics.state && (
        <p className="account-private-meta">
          Compte : {account.user.email} · Inscrit depuis le{" "}
          {new Date(joined).toLocaleDateString("fr-FR")}
        </p>
      )}
      <CosmeticCloset cosmetics={cosmetics} notify={notify} />
      {loading ? (
        <div className="panel">Chargement des statistiques…</div>
      ) : error ? (
        <div className="panel">
          Statistiques momentanément indisponibles. Revenez dans quelques instants.
        </div>
      ) : (
        stats && (
          <>
            <section className="account-stat-grid">
              <div className="panel">
                <span>Rang classé</span>
                <b>{stats.ranked.rank}</b>
              </div>
              <div className="panel">
                <span>Points classés</span>
                <b>{stats.ranked.points}</b>
                <small>
                  {stats.ranked.wins} victoires · {stats.ranked.losses} défaites
                </small>
              </div>
              <div className="panel">
                <span>Grilles solo terminées</span>
                <b>{stats.solo.games}</b>
              </div>
              <div className="panel">
                <span>Meilleur temps solo</span>
                <b>{stats.solo.best == null ? "—" : formatClock(stats.solo.best)}</b>
              </div>
              <div className="panel">
                <span>Défis du jour terminés</span>
                <b>{stats.daily}</b>
              </div>
              <div className="panel">
                <span>Défis hebdo terminés</span>
                <b>{stats.weekly}</b>
              </div>
            </section>
            <PlayerStats stats={stats} />
            <section className="panel account-history">
              <h3>Dernières grilles solo</h3>
              {stats.recent.length ? (
                stats.recent.map((result, index) => (
                  <div key={`${result.completed_at}-${index}`}>
                    <span>{result.difficulty}</span>
                    <b>{formatClock(result.elapsed_seconds)}</b>
                    <small>{new Date(result.completed_at).toLocaleDateString("fr-FR")}</small>
                  </div>
                ))
              ) : (
                <p>Aucune grille solo terminée pour le moment.</p>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
