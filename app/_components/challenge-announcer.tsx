"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import type { Achievement } from "@/lib/achievement-frames";
import { PlayerAvatar } from "./player-cosmetics";

type Award = Achievement & { unlocked: boolean };
type Payload = { achievements: Award[]; newlyUnlocked: string[] };

export function ChallengeAnnouncer({
  account,
  cosmetics,
  onDiscover,
}: {
  account: Account;
  cosmetics: Cosmetics;
  onDiscover: () => void;
}) {
  const [queue, setQueue] = useState<Award[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const checking = useRef(false);
  const userId = account.user?.id;

  useEffect(() => {
    setQueue([]);
    setPreviewId(null);
    if (!userId) return;
    let live = true;
    const key = `sudoklash-awards-announced:${userId}`;
    const check = async () => {
      if (checking.current || !live || document.hidden) return;
      checking.current = true;
      try {
        const response = await fetch("/api/achievements", {
          cache: "no-store",
          headers: await authHeaders(),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as Payload;
        if (!live) return;
        const stored = localStorage.getItem(key);
        let known: string[] = [];
        try {
          known = stored ? (JSON.parse(stored) as string[]) : [];
        } catch {
          /* invalid old data */
        }
        const unlocked = payload.achievements.filter((a) => a.unlocked);
        const fresh = unlocked.filter((a) =>
          stored ? !known.includes(a.id) : payload.newlyUnlocked?.includes(a.id),
        );
        localStorage.setItem(key, JSON.stringify(unlocked.map((a) => a.id)));
        if (fresh.length) {
          setQueue((previous) => [
            ...previous,
            ...fresh.filter((a) => !previous.some((item) => item.id === a.id)),
          ]);
        }
      } catch {
        /* try again on the next check */
      } finally {
        checking.current = false;
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 20000);
    const refresh = () => void check();
    window.addEventListener("sudoklash:progress", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.clearInterval(interval);
      window.removeEventListener("sudoklash:progress", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);

  const award = queue[0];
  const dismiss = () => {
    setPreviewId(null);
    setQueue((previous) => previous.slice(1));
  };
  useEffect(() => {
    if (!award) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (previewId === award.id) setPreviewId(null);
        else setQueue((previous) => previous.slice(1));
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [award, previewId]);
  if (!award) return null;
  const viewing = previewId === award.id;
  const rarity = {
    simple: "CLASSIQUE",
    epic: "ÉPIQUE",
    legendary: "LÉGENDAIRE",
    majestic: "MAJESTUEUX",
  }[award.rarity];
  return (
    <div
      className="challenge-reveal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenge-award-title"
    >
      <div>
        <button
          type="button"
          className="challenge-close"
          aria-label="Fermer la récompense"
          onClick={dismiss}
          autoFocus
        >
          <X aria-hidden="true" />
        </button>
        <Sparkles aria-hidden="true" />
        <span>{viewing ? "APERÇU DU CADRE" : `DÉFI ${rarity} ACCOMPLI`}</span>
        <h2 id="challenge-award-title">{award.name}</h2>
        {viewing && (
          <div className="challenge-frame-preview">
            <PlayerAvatar
              avatarId={cosmetics.state?.avatarId}
              image={cosmetics.state?.customAvatar}
              frameId={award.id}
              size="large"
            />
            <p>Ton avatar avec le cadre débloqué.</p>
          </div>
        )}
        <p>{award.requirement}</p>
        <strong>Cadre {rarity.toLowerCase()} débloqué</strong>
        {queue.length > 1 && <small>{queue.length - 1} autre(s) défi(s) accompli(s)</small>}
        <button
          type="button"
          className="primary"
          onClick={() => setPreviewId(viewing ? null : award.id)}
        >
          {viewing ? "Retour à la récompense" : "Aperçu"}
        </button>
        {!viewing && (
          <button
            type="button"
            onClick={() => {
              dismiss();
              onDiscover();
            }}
          >
            Voir mes défis
          </button>
        )}
      </div>
    </div>
  );
}
