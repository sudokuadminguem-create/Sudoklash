"use client";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/auth-headers";
import { PlayerAvatar } from "@/app/_components/player-cosmetics";
import { challengeFrameStyle, elementLabels } from "@/lib/achievement-styles";
import type { Achievement } from "@/lib/achievement-frames";

type Item = Achievement & { progress: number; unlocked: boolean };

export default function MajesticCollection() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void authHeaders()
      .then(headers => fetch("/api/admin/majestueux", { cache: "no-store", headers }))
      .then(async response => {
        if (!response.ok) throw Error("unavailable");
        return response.json() as Promise<{ achievements: Item[] }>;
      })
      .then(body => { if (active) setItems(body.achievements); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return <section className="admin-majestic">
    <div className="admin-majestic-heading">
      <span>COLLECTION PRIVÉE</span>
      <h2>Les Majestueux</h2>
      <p>25 défis cachés du catalogue public. Ils se débloquent automatiquement en jouant ; leurs cadres gagnés peuvent être équipés par les joueurs.</p>
      {items && <strong>{items.filter(item => item.unlocked).length} / 25 débloqués sur ton compte</strong>}
    </div>
    {error && <p className="admin-alert error">Impossible de charger les Majestueux. Réessaie en rouvrant cette rubrique.</p>}
    {!items && !error && <p className="admin-loading">Chargement des Majestueux…</p>}
    {items && <div className="admin-majestic-grid">
      {items.map(item => {
        const element = challengeFrameStyle(item.id)?.element;
        return <article className="admin-majestic-card" key={item.id}>
          <PlayerAvatar frameId={item.id} size="large" />
          <div>
            <small>MAJESTUEUX · {element ? elementLabels[element] : "Cadre"}</small>
            <h3>{item.name}</h3>
            <p>{item.requirement}</p>
            <div className="admin-majestic-progress" role="progressbar" aria-label={`Progression : ${item.name}`} aria-valuemin={0} aria-valuemax={item.target} aria-valuenow={Math.min(item.progress, item.target)}>
              <span style={{ width: `${Math.min(100, item.progress / item.target * 100)}%` }} />
            </div>
            <b>{item.unlocked ? "Débloqué" : `${Math.min(item.progress, item.target).toLocaleString("fr-FR")} / ${item.target.toLocaleString("fr-FR")}`}</b>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
