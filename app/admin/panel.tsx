"use client";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type Kind = "daily" | "weekly";
type Config = { title: string; puzzle: string };

export default function AdminPanel({ displayName }: { displayName: string }) {
  const [configs, setConfigs] = useState<Record<Kind, Config> | null>(null),
    [saving, setSaving] = useState<Kind | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) =>
        fetch("/api/admin/challenges", {
          cache: "no-store",
          headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
        }),
      )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Record<Kind, Config>>;
      })
      .then(setConfigs)
      .catch(() => setError("Impossible de charger les réglages."));
  }, []);
  const update = (kind: Kind, key: keyof Config, value: string) =>
    setConfigs((current) =>
      current ? { ...current, [kind]: { ...current[kind], [key]: value } } : current,
    );
  const save = async (kind: Kind) => {
    if (!configs) return;
    setSaving(kind);
    setMessage("");
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        body: JSON.stringify({ kind, ...configs[kind] }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(
          body.error === "invalid_puzzle"
            ? "La grille doit contenir exactement 81 chiffres et posséder une solution."
            : "Enregistrement impossible.",
        );
        return;
      }
      setMessage(`${kind === "daily" ? "Grille quotidienne" : "Grille hebdomadaire"} mise à jour.`);
    } catch {
      setError("Enregistrement impossible. Vérifiez votre connexion.");
    } finally {
      setSaving(null);
    }
  };
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link href="/">
          <ChevronLeft />
          Retour au jeu
        </Link>
        <div>
          <LockKeyhole />
          <span>SUDOKU CLASH</span>
          <b>Administration privée</b>
        </div>
        <small>{displayName}</small>
      </header>
      <section className="admin-content">
        <div className="admin-intro">
          <div>
            <span className="admin-pill">
              <ShieldCheck />
              Accès propriétaire uniquement
            </span>
            <h1>Panneau d’administration</h1>
            <p>
              Modifiez les défis actifs. Les changements sont appliqués immédiatement aux joueurs
              qui n’ont pas encore commencé.
            </p>
          </div>
        </div>
        {error && <div className="admin-alert error">{error}</div>}
        {message && (
          <div className="admin-alert success">
            <Check />
            {message}
          </div>
        )}
        {!configs ? (
          <div className="admin-loading">Chargement des réglages…</div>
        ) : (
          <div className="admin-grid">
            {(["daily", "weekly"] as Kind[]).map((kind) => (
              <article className="admin-card" key={kind}>
                <span>{kind === "daily" ? "DÉFI QUOTIDIEN" : "DÉFI HEBDOMADAIRE"}</span>
                <h2>{kind === "daily" ? "Chaque jour" : "Chaque semaine"}</h2>
                <label>
                  Nom du défi
                  <input
                    value={configs[kind].title}
                    maxLength={80}
                    onChange={(event) => update(kind, "title", event.target.value)}
                  />
                </label>
                <label>
                  Grille Sudoku
                  <textarea
                    value={configs[kind].puzzle}
                    maxLength={81}
                    spellCheck={false}
                    onChange={(event) =>
                      update(kind, "puzzle", event.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                  <small>
                    {configs[kind].puzzle.length}/81 chiffres · utilisez 0 pour une case vide
                  </small>
                </label>
                <button onClick={() => save(kind)} disabled={saving !== null}>
                  <Save />
                  {saving === kind ? "Enregistrement…" : "Enregistrer"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
