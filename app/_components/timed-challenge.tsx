"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, Timer, Trophy, X } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { formatDuration } from "@/app/lib/format-time";
import { SudokuBoard } from "./sudoku-board";

type ChallengeData = {
  status: "not_started" | "in_progress" | "completed" | "failed";
  title: string;
  puzzle: number[];
  nextAt: string;
  startedAt: string | null;
  elapsedSeconds: number | null;
  mistakes: number;
};

export function TimedChallenge({
  kind,
  openAuth,
}: {
  kind: "daily" | "weekly";
  openAuth: () => void;
}) {
  const [data, setData] = useState<ChallengeData | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [authRequired, setAuthRequired] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(0),
    [pendingGrid, setPendingGrid] = useState<number[] | null>(null);
  const isDaily = kind === "daily",
    label = isDaily ? "GRILLE DU JOUR" : "GRILLE HEBDOMADAIRE",
    frequency = isDaily ? "jour" : "semaine";
  useEffect(() => {
    let live = true;
    authHeaders()
      .then((headers) => fetch(`/api/${kind}`, { cache: "no-store", headers }))
      .then(async (response) => {
        if (response.status === 401) {
          if (live) setAuthRequired(true);
          return null;
        }
        if (!response.ok) throw new Error("challenge_load");
        return response.json() as Promise<ChallengeData>;
      })
      .then((value) => {
        if (live && value) setData(value);
      })
      .catch(() => {
        if (live)
          setError(
            `La grille ${isDaily ? "quotidienne" : "hebdomadaire"} est momentanément indisponible.`,
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [kind, isDaily]);
  useEffect(() => {
    if (!data) return;
    const initial = setTimeout(() => setNow(Date.now()), 0),
      timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [data]);
  const request = async (action: "ready" | "complete", grid?: number[]) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action, grid }),
      });
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      if (!response.ok) throw new Error("challenge_save");
      setData(await response.json());
      setPendingGrid(null);
    } catch {
      setError("Impossible d’enregistrer la tentative. Vérifiez votre connexion puis réessayez.");
    } finally {
      setBusy(false);
    }
  };
  const reportMistake = async (index: number, number: number, mistakeId: string) => {
    const response = await fetch(`/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ action: "mistake", index, number, mistakeId }),
    });
    if (response.status === 401) {
      setAuthRequired(true);
      throw new Error("authentication_required");
    }
    if (!response.ok) throw new Error("mistake_save");
    const updated = (await response.json()) as ChallengeData;
    setData(updated);
    return updated.mistakes;
  };
  const remaining =
    data && now ? Math.max(0, Math.ceil((new Date(data.nextAt).getTime() - now) / 1000)) : 0;
  if (loading)
    return (
      <div className="panel weekly-state">
        <Timer />
        <h2>Chargement de la grille…</h2>
      </div>
    );
  if (authRequired)
    return (
      <div className="panel weekly-state">
        <ShieldCheck />
        <span className="eyebrow">TENTATIVE PROTÉGÉE</span>
        <h2>Connectez-vous avant de jouer</h2>
        <p>
          Votre compte Sudoku Clash enregistre votre départ, votre temps et votre participation du{" "}
          {frequency}.
        </p>
        <button className="primary" onClick={openAuth}>
          Se connecter ou créer un compte
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="panel weekly-state error">
        <X />
        <h2>Grille indisponible</h2>
        <p>{error}</p>
        <button className="primary" onClick={() => location.reload()}>
          Réessayer
        </button>
      </div>
    );
  if (!now)
    return (
      <div className="panel weekly-state">
        <Timer />
        <h2>Préparation de la grille…</h2>
      </div>
    );
  if (data.status === "completed")
    return (
      <div className="panel weekly-state weekly-complete">
        <Trophy />
        <span className="eyebrow">GRILLE TERMINÉE</span>
        <h2>Votre temps : {formatDuration(data.elapsedSeconds || 0)}</h2>
        <p>Votre tentative est enregistrée. Cette grille ne peut plus être rejouée.</p>
        <div className="next-week">
          <span>Prochaine grille dans</span>
          <b>{formatDuration(remaining)}</b>
        </div>
      </div>
    );
  if (data.status === "failed")
    return (
      <div className="panel weekly-state weekly-failed">
        <X />
        <span className="eyebrow">TENTATIVE TERMINÉE</span>
        <h2>Trois erreurs : grille perdue</h2>
        <p>Cette grille ne peut plus être terminée ni rejouée.</p>
        <div className="next-week">
          <span>Nouvelle grille dans</span>
          <b>{formatDuration(remaining)}</b>
        </div>
      </div>
    );
  const initialSeconds =
    data.startedAt && now
      ? Math.max(0, Math.floor((now - new Date(data.startedAt).getTime()) / 1000))
      : 0;
  return (
    <div className="play-layout">
      <div>
        <SudokuBoard
          key={data.startedAt || `${kind}-ready`}
          difficulty={isDaily ? "Facile" : "Difficile"}
          puzzleOverride={data.puzzle}
          competitive
          title={`${data.title} — Défi ${isDaily ? "quotidien" : "hebdomadaire"}`}
          active={data.status === "in_progress"}
          initialSeconds={initialSeconds}
          initialMistakes={data.mistakes}
          onMistake={reportMistake}
          replayable={false}
          challengeLabel={label}
          onReady={() => request("ready")}
          readyBusy={busy}
          onSolved={(grid) => {
            setPendingGrid(grid);
            request("complete", grid);
          }}
        />
        {error && (
          <div className="weekly-error">
            {error}
            <button
              onClick={() => (pendingGrid ? request("complete", pendingGrid) : request("ready"))}
              disabled={busy}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
      <aside className="card rightcol weekly-rules">
        <span className="eyebrow">RÈGLES DU DÉFI</span>
        <h3>Un {frequency}, une chance</h3>
        <p>
          La grille apparaît au clic sur « Je suis prêt ». Le chronomètre continue même si vous
          fermez la page.
        </p>
        <p>Trois erreurs mettent fin à la tentative.</p>
        <div className="next-week compact">
          <span>Nouvelle grille dans</span>
          <b>{formatDuration(remaining)}</b>
        </div>
        <span className="fair">
          <ShieldCheck />
          Départ et résultat vérifiés
        </span>
      </aside>
    </div>
  );
}
