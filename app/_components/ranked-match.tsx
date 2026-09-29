"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Users, X, Trophy } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { formatClock } from "@/app/lib/format-time";
import type { AccountState } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { ExperienceProgress } from "./experience-progress";

export type RankedState = {
  status: "idle" | "waiting" | "playing" | "finished";
  queuedAt?: number;
  id?: string;
  puzzle?: string;
  difficulty?: "Facile" | "Intermédiaire" | "Difficile" | "Expert" | "Maître";
  startedAt?: number;
  finishedAt?: number | null;
  winnerId?: string | null;
  finishReason?: string | null;
  opponentName?: string;
  opponentProgress?: number;
  myFilled?: number;
  opponentFilled?: number;
  totalToFill?: number;
  difference?: number;
  durationSeconds?: number | null;
  mistakes?: number;
  /** Verdict on the digit sent with a "check" request. */
  correct?: boolean;
  points?: number;
  pointsBefore?: number | null;
  pointsChange?: number | null;
  rank?: { label: string; difficulty: string; progress: number };
  wins?: number;
  losses?: number;
};

export async function rankedRequest(action?: string, fields: Record<string, unknown> = {}) {
  const response = await fetch("/api/ranked", {
    method: action ? "POST" : "GET",
    cache: "no-store",
    headers: {
      ...(await authHeaders()),
      ...(action ? { "Content-Type": "application/json" } : {}),
    },
    ...(action ? { body: JSON.stringify({ action, ...fields }) } : {}),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Connecte-toi pour jouer en classé."
        : "La recherche de match est momentanément indisponible.",
    );
  return response.json() as Promise<RankedState>;
}

export function RankedMatch({
  account,
  cosmetics,
  openAuth,
  renderGame,
}: {
  account: AccountState;
  cosmetics: Cosmetics;
  openAuth: () => void;
  renderGame: (match: RankedState, refresh: () => Promise<void>) => React.ReactNode;
}) {
  const [state, setState] = useState<RankedState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reward, setReward] = useState<{ matchId: string; totalXp: number } | null>(null);
  const statusRef = useRef<RankedState["status"] | undefined>(undefined);
  useEffect(() => {
    statusRef.current = state?.status;
  }, [state?.status]);
  const refresh = useCallback(async () => {
    try {
      setState(await rankedRequest());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion indisponible");
    }
  }, []);
  useEffect(() => {
    if (!account.user) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => {
      clearInterval(timer);
      if (statusRef.current === "waiting") void rankedRequest("cancel").catch(() => {});
    };
  }, [account.user?.id, refresh]);
  useEffect(() => {
    if (state?.status !== "finished" || !state.id) return;
    let live = true;
    const matchId = state.id;
    void cosmetics.refresh().then((updated) => {
      if (live && updated) setReward({ matchId, totalXp: updated.xp });
    });
    return () => { live = false; };
  }, [state?.status, state?.id, cosmetics.refresh]);
  const submit = async (action: "join" | "cancel") => {
    setBusy(true);
    setError("");
    try {
      setState(await rankedRequest(action));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion indisponible");
    } finally {
      setBusy(false);
    }
  };
  if (!account.user)
    return (
      <div className="panel locked-real">
        <Users />
        <h2>Connecte-toi pour jouer en classé</h2>
        <p>Ton compte permet de te retrouver automatiquement un adversaire.</p>
        <button className="primary" onClick={openAuth}>
          Se connecter ou créer un compte
        </button>
      </div>
    );
  if (state?.status === "playing") return renderGame(state, refresh);
  if (state?.status === "finished") {
    const won = state.winnerId === account.user.id,
      change = state.pointsChange;
    return (
      <div className="panel ranked-lobby ranked-finished">
        {won ? <Trophy /> : <X />}
        <span className="eyebrow">RÉSUMÉ DE PARTIE CLASSÉE</span>
        <h2>{won ? "Victoire !" : "Défaite"}</h2>
        <p>
          Contre {state.opponentName} · Grille {state.difficulty}
          {state.finishReason === "three_mistakes" ? " · Fin après trois erreurs" : ""}
          {state.finishReason === "forfeit"
            ? won
              ? " · Ton adversaire a abandonné"
              : " · Partie abandonnée"
            : ""}
        </p>
        <div className="ranked-summary">
          <div>
            <span>Temps de la partie</span>
            <strong>{formatClock(state.durationSeconds ?? 0)}</strong>
          </div>
          <div>
            <span>Vos cases correctes</span>
            <strong>
              {state.myFilled ?? 0} / {state.totalToFill ?? 0}
            </strong>
          </div>
          <div>
            <span>Cases de {state.opponentName}</span>
            <strong>
              {state.opponentFilled ?? 0} / {state.totalToFill ?? 0}
            </strong>
          </div>
          <div>
            <span>Écart de cases</span>
            <strong>{state.difference ?? 0}</strong>
          </div>
        </div>
        <div className={`ranked-points ${won ? "gain" : "loss"}`}>
          <span>
            {state.rank?.label ?? "Bronze 1"} · {state.points ?? 0} points
          </span>
          <strong>
            {change == null ? "Calcul des points…" : `${change > 0 ? "+" : ""}${change} points`}
          </strong>
        </div>
        {reward && reward.matchId === state.id && <ExperienceProgress gained={won ? 120 : 40} totalXp={reward.totalXp} />}
        <button className="primary" disabled={busy} onClick={() => submit("join")}>
          {busy ? "Recherche…" : "Trouver un autre match"}
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="panel ranked-lobby">
      <Search />
      <span className="eyebrow">PARTIE CLASSÉE · {state?.rank?.label ?? "Bronze 1"}</span>
      <h2>{state?.status === "waiting" ? "Recherche d’un adversaire…" : "Trouver un match"}</h2>
      <p>
        {state?.status === "waiting"
          ? "Tu es dans la file d’attente. La partie commencera automatiquement dès qu’un autre joueur de ton niveau sera trouvé."
          : `Grille ${state?.rank?.difficulty ?? "Facile"} · ${state?.points ?? 0} points classés. Lance la recherche pour affronter un joueur disponible.`}
      </p>
      {state?.status === "waiting" ? (
        <>
          <div className="ranked-search" role="status">
            <span className="ranked-spinner" />
            Dans la file d’attente · Grille {state.rank?.difficulty}
          </div>
          <button className="ranked-cancel" disabled={busy} onClick={() => submit("cancel")}>
            Annuler la recherche
          </button>
        </>
      ) : (
        <button className="primary" disabled={busy || !state} onClick={() => submit("join")}>
          {busy ? "Recherche…" : "Trouver un match"}
        </button>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
