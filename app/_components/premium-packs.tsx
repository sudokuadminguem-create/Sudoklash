"use client";
import { useEffect, useState } from "react";
import { Gem } from "lucide-react";
import { premiumPacks, euroPrice } from "@/lib/premium";
import { authHeaders } from "@/app/lib/auth-headers";
import type { Cosmetics } from "@/hooks/use-cosmetics";
export function PremiumPacks({
  signedIn,
  openAuth,
  cosmetics,
}: {
  signedIn: boolean;
  openAuth: () => void;
  cosmetics: Cosmetics;
}) {
  const [available, setAvailable] = useState<boolean | null>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    void fetch("/api/premium/checkout", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ available: boolean }>)
      .then((v: { available: boolean }) => {
        if (live) setAvailable(v.available);
      })
      .catch(() => {
        if (live) setAvailable(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(location.search),
      sessionId = query.get("premium_session");
    if (query.has("premium_cancelled")) setMessage("Paiement annulé. Aucun crédit n’a été ajouté.");
    if (!signedIn || !sessionId) return;
    let live = true;
    const verify = async () => {
      setMessage("Vérification du paiement…");
      try {
        const r = await fetch("/api/premium/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ action: "verify", sessionId }),
        });
        if (!r.ok) throw Error("verify");
        const data = (await r.json()) as { gems: number };
        await cosmetics.refresh();
        if (live) {
          setMessage(`Paiement confirmé : ${data.gems} Sudogemmes créditées.`);
          const url = new URL(location.href);
          url.searchParams.delete("premium_session");
          history.replaceState(null, "", url);
        }
      } catch {
        if (live)
          setMessage(
            "Paiement en attente de confirmation. Tes Sudogemmes seront créditées après validation ; tu peux actualiser cette page.",
          );
      }
    };
    void verify();
    return () => {
      live = false;
    };
  }, [signedIn]);
  const buy = async (packId: string) => {
    if (!signedIn) {
      openAuth();
      return;
    }
    setBusy(packId);
    setMessage("");
    try {
      const r = await fetch("/api/premium/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ packId }),
      });
      if (!r.ok) throw Error("checkout");
      const data = (await r.json()) as { url: string };
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw Error("url");
      location.assign(url.href);
    } catch {
      setMessage("Paiement indisponible pour le moment. Aucun crédit ajouté.");
      setBusy("");
    }
  };
  return (
    <section className="premium-section" aria-label="Packs de Sudogemmes">
      <span className="eyebrow">MONNAIE PREMIUM</span>
      <h2>Les Sudogemmes</h2>
      <p>
        Achète des cosmétiques avec cette monnaie payante. Les Sudokoins gagnés en jouant restent
        disponibles pour tous les articles.
      </p>
      {available === false && (
        <p className="premium-unavailable" role="status">
          Les packs sont prêts. Les paiements ne sont pas encore activés.
        </p>
      )}
      <div className="premium-packs">
        {premiumPacks.map((p) => (
          <article key={p.id}>
            <Gem aria-hidden="true" />
            <h3>{p.name}</h3>
            <strong>{p.gems.toLocaleString("fr-FR")}</strong>
            <span>Sudogemmes</span>
            <button
              className="primary"
              disabled={available !== true || !!busy}
              onClick={() => void buy(p.id)}
            >
              {busy === p.id ? "Ouverture du paiement…" : `Acheter · ${euroPrice(p.cents)}`}
            </button>
          </article>
        ))}
      </div>
      <p>
        Paiement unique. Aucun abonnement. Crédit sur ton compte après confirmation du paiement.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
