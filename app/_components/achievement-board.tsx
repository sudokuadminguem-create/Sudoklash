"use client";
import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { PlayerAvatar } from "./player-cosmetics";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import type { AccountState } from "@/hooks/use-account";
import type { Achievement } from "@/lib/achievement-frames";
import { challengeFrameStyle, elementLabels } from "@/lib/achievement-styles";

type Item = Achievement & { progress: number; unlocked: boolean };
type Payload = { achievements: Item[]; visibleTotal: number; secretUnlocked: number; newlyUnlocked: string[] };
type Category = "all" | Achievement["rarity"];
export function AchievementBoard({
  account,
  cosmetics,
  openAuth,
  notify,
}: {
  account: AccountState;
  cosmetics: Cosmetics;
  openAuth: () => void;
  notify: (message: string) => void;
}) {
  const [data, setData] = useState<Payload | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  const [tab, setTab] = useState<"todo" | "done" | "frames">("todo"),
    [category, setCategory] = useState<Category>("all"),
    [busy, setBusy] = useState("");
  useEffect(() => {
    if (!account.user) {
      setData(null);
      return;
    }
    let live = true;
    setLoading(true);
    setError(false);
    void authHeaders()
      .then((headers) => fetch("/api/achievements", { cache: "no-store", headers }))
      .then(async (response) => {
        if (!response.ok) throw Error("unavailable");
        return response.json() as Promise<Payload>;
      })
      .then((payload) => {
        if (!live) return;
        setData(payload);
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
  }, [account.user?.id]);
  const visible = data?.achievements.filter((a) => a.rarity === "simple") ?? [];
  const done = data?.achievements.filter((a) => a.unlocked) ?? [];
  const remaining = data?.achievements.filter((a) => !a.unlocked) ?? [];
  const epicCount = done.filter((a) => a.rarity === "epic").length;
  const legendaryCount = done.filter((a) => a.rarity === "legendary").length;
  const displayed = useMemo(
    () => (tab === "todo" ? remaining : done)
      .filter((a) => category === "all" || a.rarity === category),
    [tab, category, data],
  );
  const equip = async (id: string) => {
    setBusy(id);
    try {
      await cosmetics.action("equip_frame", id);
      notify("Cadre équipé sur ton avatar");
    } catch {
      notify("Impossible d'équiper ce cadre.");
    } finally {
      setBusy("");
    }
  };
  if (!account.user)
    return (
      <section className="panel challenge-intro">
        <Trophy />
        <h2>Défis et cadres</h2>
        <p>Connecte-toi pour suivre tes défis et gagner des cadres d’avatar.</p>
        <button className="primary" onClick={openAuth}>
          Se connecter
        </button>
      </section>
    );
  return (
    <div className="challenge-board">
      <section className="challenge-hero">
        <div>
          <span className="eyebrow">TA COLLECTION</span>
          <h2>Défis</h2>
          <p>Chaque objectif accompli débloque un cadre à équiper sur ton avatar.</p>
        </div>
        <div className="challenge-tally">
          <strong>
            {visible.filter((a) => a.unlocked).length}
            <span> / 100</span>
          </strong>
          <small>défis classiques terminés</small>
        </div>
      </section>
      <div className="challenge-tabs" role="group" aria-label="Afficher les défis">
        <button className={tab === "todo" ? "active" : ""} onClick={() => setTab("todo")}>
          À faire <span>{remaining.length}</span>
        </button>
        <button className={tab === "done" ? "active" : ""} onClick={() => setTab("done")}>
          Terminés <span>{done.length}</span>
        </button>
        <button className={tab === "frames" ? "active" : ""} onClick={() => setTab("frames")}>
          Mes cadres <span>{done.length}</span>
        </button>
      </div>
      <div className="challenge-filter">
        <strong>Filtrer par rareté</strong>
        <div className="challenge-categories" role="group" aria-label="Filtrer les défis par rareté">
        {([
          ["all", "Tous", tab === "todo" ? remaining.length : done.length],
          ["simple", "Classiques", tab === "todo" ? 100 - visible.filter((a) => a.unlocked).length : visible.filter((a) => a.unlocked).length],
          ["epic", "Épiques", tab === "todo" ? 25 - epicCount : epicCount],
          ["legendary", "Légendaires", tab === "todo" ? 25 - legendaryCount : legendaryCount],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            className={`${id}${category === id ? " active" : ""}`}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            <span>{label}</span><small>{count}</small>
          </button>
        ))}
        </div>
      </div>
      {loading && <p className="challenge-message">Chargement des défis…</p>}
      {error && (
        <div className="challenge-message">
          <p>Défis momentanément indisponibles.</p>
          <button onClick={() => window.location.reload()}>Réessayer</button>
        </div>
      )}
      {data && (
        <>
          <div className={`challenge-grid${tab === "frames" ? " frame-gallery" : ""}`}>
            {displayed.map((a) => (
              <article
                key={a.id}
                className={`challenge-item ${a.rarity}${a.unlocked ? " unlocked" : ""}`}
              >
                <PlayerAvatar
                  avatarId={cosmetics.state?.avatarId}
                  image={cosmetics.state?.customAvatar}
                  frameId={a.id}
                  size="large"
                />
                <div className="challenge-detail">
                  <span className="challenge-rarity">
                    {a.rarity === "simple"
                      ? "THÉMATIQUE"
                      : a.rarity === "epic"
                        ? "ÉPIQUE"
                        : "LÉGENDAIRE"}
                    {challengeFrameStyle(a.id)?.element && ` · ${elementLabels[challengeFrameStyle(a.id)!.element!]}`}
                  </span>
                  <h3>{a.name}</h3>
                  {tab !== "frames" && <p>{a.requirement}</p>}
                  {tab === "todo" ? (
                    <>
                      <div
                        className="challenge-progress"
                        role="progressbar"
                        aria-label={`Progression : ${a.name}`}
                        aria-valuemin={0}
                        aria-valuemax={a.target}
                        aria-valuenow={Math.min(a.progress, a.target)}
                      >
                        <span
                          style={{ width: `${Math.min(100, (100 * a.progress) / a.target)}%` }}
                        />
                      </div>
                      <small>
                        {Math.min(a.progress, a.target).toLocaleString("fr-FR")} /{" "}
                        {a.target.toLocaleString("fr-FR")}
                      </small>
                    </>
                  ) : (
                    <button
                      className="challenge-equip"
                      disabled={!!busy || cosmetics.state?.frameSelection === a.id}
                      onClick={() => void equip(a.id)}
                    >
                      {cosmetics.state?.frameSelection === a.id ? "Équipé" : "Équiper ce cadre"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {displayed.length === 0 && (
            <p className="challenge-message">
              {tab === "todo"
                ? "Tous les défis de cette catégorie sont terminés !"
                : category === "epic" || category === "legendary"
                  ? `Aucun cadre ${category === "epic" ? "épique" : "légendaire"} découvert pour le moment.`
                  : "Termine un défi pour gagner ton premier cadre."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
