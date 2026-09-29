"use client";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/auth-headers";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import type { Achievement } from "@/lib/achievement-frames";
import { PlayerAvatar } from "./player-cosmetics";

type Challenge = Achievement & { progress: number; unlocked: boolean };
const rarityOrder = { legendary: 3, epic: 2, simple: 1, majestic: 0 };

/** Pick by completion percentage first, then display those three by rarity. */
export function closestChallenges(challenges: Challenge[]) {
  return challenges
    .filter((item) => !item.unlocked && item.target > 0)
    .sort((a, b) =>
      b.progress / b.target - a.progress / a.target ||
      rarityOrder[b.rarity] - rarityOrder[a.rarity] ||
      a.name.localeCompare(b.name, "fr"),
    )
    .slice(0, 3)
    .sort((a, b) =>
      rarityOrder[b.rarity] - rarityOrder[a.rarity] ||
      b.progress / b.target - a.progress / a.target,
    );
}

export function NearChallenges({ account, cosmetics }: { account: Account; cosmetics: Cosmetics }) {
  const [items, setItems] = useState<Challenge[]>([]);
  const userId = account.user?.id;
  useEffect(() => {
    setItems([]);
    if (!userId) return;
    let live = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/achievements", {
          cache: "no-store", headers: await authHeaders(),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { achievements: Challenge[] };
        if (live) setItems(closestChallenges(data.achievements));
      } catch { /* keep the last available progress */ }
    };
    void refresh();
    const update = () => void refresh();
    window.addEventListener("sudoklash:progress", update);
    return () => { live = false; window.removeEventListener("sudoklash:progress", update); };
  }, [userId]);
  if (!userId || items.length === 0) return null;
  return (
    <section className="near-challenges" aria-labelledby="near-challenges-title">
      <div className="near-challenges-heading">
        <h3 id="near-challenges-title">Défis presque terminés</h3>
      </div>
      <div className="near-challenges-list">
        {items.map((item) => (
          <article className={`near-challenge ${item.rarity}`} key={item.id}>
            <div className="near-challenge-reward">
              <PlayerAvatar avatarId={cosmetics.state?.avatarId} image={cosmetics.state?.customAvatar} frameId={item.id} />
              <div className="near-challenge-labels">
                <span className="challenge-rarity">{item.rarity === "legendary" ? "LÉGENDAIRE" : item.rarity === "epic" ? "ÉPIQUE" : "CLASSIQUE"} · CADRE À GAGNER</span>
                <strong>{item.name}</strong>
              </div>
            </div>
            <small title={item.requirement}>{item.requirement}</small>
            <div className="challenge-progress" role="progressbar" aria-label={`Progression : ${item.name}`} aria-valuemin={0} aria-valuemax={item.target} aria-valuenow={Math.min(item.progress, item.target)}>
              <span style={{ width: `${Math.min(100, item.progress / item.target * 100)}%` }} />
            </div>
            <b>{Math.min(item.progress, item.target).toLocaleString("fr-FR")} / {item.target.toLocaleString("fr-FR")}</b>
          </article>
        ))}
      </div>
    </section>
  );
}
