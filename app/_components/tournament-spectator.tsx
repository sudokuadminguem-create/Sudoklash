"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import type { LiveTournament } from "@/lib/tournament-spectator";

const refreshMs = 2000;
const playerStatus = { playing: "En jeu", finished: "Grille terminée", eliminated: "Éliminé" };

export function TournamentSpectator({ id, onClose }: { id: string; onClose: () => void }) {
  const [view, setView] = useState<LiveTournament | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    let stopped = false;
    const load = async () => {
      if (pending || stopped || document.hidden) return;
      pending = true;
      try {
        const headers = await authHeaders();
        const response = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}&spectate=1`, {
          headers,
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as LiveTournament & { error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok) {
          stopped = response.status === 401 || response.status === 403 || response.status === 404;
          throw new Error(data.error ?? "Le direct est momentanément indisponible.");
        }
        setView(data);
        setError("");
        stopped = !data.live;
      } catch (error) {
        if (!controller.signal.aborted) {
          setView(null);
          setError(
            stopped && error instanceof Error
              ? error.message
              : "Connexion au direct interrompue. Nouvelle tentative automatique…",
          );
        }
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), refreshMs);
    const resume = () => void load();
    document.addEventListener("visibilitychange", resume);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [id]);

  return (
    <section className="panel tournament-card tournament-spectator" aria-label="Mode spectateur">
      <div className="tournament-spectator-heading">
        <div>
          <span className="tournament-live-label">
            <Eye aria-hidden="true" /> MODE SPECTATEUR
          </span>
          <h3>Le tournoi en direct</h3>
        </div>
        <button className="tournament-link" type="button" onClick={onClose}>
          Quitter le direct
        </button>
      </div>
      {error ? (
        <p role="status">{error}</p>
      ) : !view ? (
        <p role="status">Chargement du direct…</p>
      ) : !view.live ? (
        <p role="status">
          Le direct est terminé. Retrouve les résultats dans le classement officiel.
        </p>
      ) : (
        <div className="tournament-spectator-content">
          {view.leader && (
            <div className="tournament-leader">
              <h4>Grille en tête · {view.ranking[0].name}</h4>
              <p>
                <strong>
                  {view.ranking[0].correct} / {view.total}
                </strong>{" "}
                cases trouvées
              </p>
              <table
                className="tournament-live-grid"
                aria-label={`Grille de ${view.ranking[0].name}, en lecture seule`}
              >
                <tbody>
                  {Array.from({ length: 9 }, (_, row) => (
                    <tr key={row}>
                      {Array.from({ length: 9 }, (_, col) => {
                        const index = row * 9 + col;
                        const digit = view.leader!.grid[index];
                        const given = view.leader!.givens[index] !== "0";
                        return (
                          <td key={col} className={given ? undefined : "tournament-found"}>
                            <span>{digit !== "0" ? digit : null}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tournament-grid-key">
                <span>Chiffres de départ</span>
                <span>Chiffres trouvés</span>
              </p>
            </div>
          )}
          <div>
            <h4>Classement en direct</h4>
            <p>Trié par cases correctement remplies. Les cases de départ ne comptent pas.</p>
            <ol
              className="tournament-ranking tournament-live-ranking"
              aria-label="Classement provisoire"
            >
              {view.ranking.map((row) => (
                <li key={row.place}>
                  <b>
                    {row.place}. {row.name}
                  </b>
                  <span>
                    {row.correct} / {view.total} · {playerStatus[row.status]}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
