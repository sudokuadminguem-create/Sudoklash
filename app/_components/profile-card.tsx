"use client";

import { useState } from "react";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { profileCards, profileTitles } from "@/lib/profile-rewards";
import { formatClock } from "@/app/lib/format-time";
import { PlayerAvatar } from "./player-cosmetics";

export type CardStats = {
  solo: { games: number };
  daily: number;
  weekly: number;
  ranked: { points: number; wins: number; rank: string };
  bestByDifficulty: { difficulty: string; best: number }[];
};

export type ProfileLook = {
  avatarId: string;
  customAvatar?: string | null;
  image?: string | null;
  frameId: string;
  profileCardId: string;
  profileTitleId: string;
};

export function ProfileCardDisplay({ username, stats, look }: {
  username: string;
  stats: CardStats;
  look: ProfileLook;
}) {
  const title = profileTitles.find((item) => item.id === look.profileTitleId);
  const best = stats.bestByDifficulty.find((item) => item.difficulty === "Intermédiaire")
    ?? stats.bestByDifficulty.find((item) => item.difficulty === "Facile")
    ?? stats.bestByDifficulty[0];
  return (
    <div className={`profile-card profile-card-${look.profileCardId}`}>
      <div className="profile-card-top">
        <PlayerAvatar avatarId={look.avatarId} image={look.customAvatar ?? look.image} frameId={look.frameId} size="large" />
        <div className="profile-card-identity">
          <strong>{username}</strong>
          {title?.id !== "none" && <span className="profile-subtitle">{title?.name}</span>}
          <small>{stats.ranked.rank} · {stats.ranked.points} points</small>
        </div>
      </div>
      <div className="profile-card-stats">
        <div><b>{stats.ranked.wins}</b><span>Victoires</span></div>
        <div><b>{stats.solo.games}</b><span>Grilles solo</span></div>
        <div><b>{stats.daily + stats.weekly}</b><span>Défis réussis</span></div>
      </div>
      <div className="profile-card-best">
        <span>Meilleur temps {best?.difficulty ?? "solo"}</span>
        <b>{best ? formatClock(best.best) : "—"}</b>
      </div>
    </div>
  );
}

export function ProfileCardStudio({ username, stats, cosmetics, notify }: {
  username: string;
  stats: CardStats;
  cosmetics: Cosmetics;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const selected = cosmetics.state!;
  const equip = async (action: "equip_profile_card" | "equip_profile_title", id: string) => {
    setBusy(id);
    try {
      await cosmetics.action(action, id);
      notify("Profil mis à jour");
    } catch {
      notify("Impossible d’équiper cette récompense. Réessayez.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel profile-studio" aria-label="Ma carte de profil">
      <div className="profile-studio-heading">
        <div>
          <span className="eyebrow">MA CARTE DE PROFIL</span>
          <h3>Une identité à gagner, à afficher</h3>
        </div>
      </div>
      <ProfileCardDisplay username={username} stats={stats} look={selected} />
      <div className="profile-rewards">
        <div>
          <h4>Styles de carte</h4>
          <p>Gagne des cartes en jouant, puis choisis celle à afficher.</p>
          <div className="profile-reward-grid">
            {profileCards.map((card) => {
              const owned = selected.ownedCards.includes(card.id), active = selected.profileCardId === card.id;
              return <button key={card.id} className={`profile-reward ${active ? "selected" : ""}`} disabled={!owned || !!busy} aria-pressed={active} onClick={() => void equip("equip_profile_card", card.id)}>
                <span className={`profile-reward-swatch profile-card-${card.id}`} aria-hidden="true" />
                <b>{card.name}</b><small>{active ? "Équipée" : owned ? "Équiper" : card.requirement}</small>
              </button>;
            })}
          </div>
        </div>
        <div>
          <h4>Sous-noms</h4>
          <p>Ton sous-nom s’affiche sous ton pseudo.</p>
          <div className="profile-title-grid">
            {profileTitles.map((reward) => {
              const owned = selected.ownedTitles.includes(reward.id), active = selected.profileTitleId === reward.id;
              return <button key={reward.id} className={`profile-title ${active ? "selected" : ""}`} disabled={!owned || !!busy} aria-pressed={active} onClick={() => void equip("equip_profile_title", reward.id)}>
                <b>{reward.name}</b><small>{active ? "Équipé" : owned ? "Équiper" : reward.requirement}</small>
              </button>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
