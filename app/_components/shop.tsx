"use client";
import { useState } from "react";
import { Coins } from "lucide-react";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { gridThemes } from "@/lib/cosmetics";
import { AvatarShop } from "./player-cosmetics";

export function Shop({
  notify,
  cosmetics,
  account,
  openAuth,
}: {
  notify: (value: string) => void;
  cosmetics: Cosmetics;
  account: Account;
  openAuth: () => void;
}) {
  const [tab, setTab] = useState<"themes" | "avatars">("themes"),
    [busy, setBusy] = useState("");
  const data = cosmetics.state;
  const choose = async (id: string) => {
    if (!data) return;
    setBusy(id);
    try {
      const owned = data.ownedThemes.includes(id);
      await cosmetics.action(owned ? "equip_theme" : "buy_theme", id);
      if (!owned) await cosmetics.action("equip_theme", id);
      notify(owned ? "Fond équipé" : "Fond débloqué et équipé");
    } catch (e) {
      notify(
        e instanceof Error && e.message === "not_enough_coins"
          ? "Pas assez de Sudokoins"
          : "Opération indisponible. Réessaie.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <div>
      <div className="shop-hero">
        <div>
          <span className="eyebrow">PERSONNALISATION ÉQUITABLE</span>
          <h2>Ton style. Zéro avantage.</h2>
          <p>Tous les éléments de la boutique sont uniquement cosmétiques.</p>
        </div>
        <div>
          <Coins />
          <span>TON SOLDE</span>
          <b>{data?.coins.toLocaleString("fr-FR") ?? "—"}</b>
          <small>SUDOKOINS</small>
        </div>
      </div>
      <div className="shop-tabs">
        <button className={tab === "themes" ? "active" : ""} onClick={() => setTab("themes")}>
          Fonds de grille
        </button>
        <button className={tab === "avatars" ? "active" : ""} onClick={() => setTab("avatars")}>
          Avatars
        </button>
      </div>
      {tab === "avatars" ? (
        <AvatarShop cosmetics={cosmetics} account={account} notify={notify} openAuth={openAuth} />
      ) : !account.user ? (
        <div className="panel cosmetic-closet">
          <p>Connecte-toi pour enregistrer tes fonds de grille.</p>
          <button className="primary" onClick={openAuth}>
            Se connecter
          </button>
        </div>
      ) : !data ? (
        <div className="panel cosmetic-closet">Chargement de la boutique…</div>
      ) : (
        <div className="shop-grid">
          {gridThemes.map((t) => (
            <article className="product" key={t.id}>
              <div
                className="theme-preview"
                style={{
                  background: `radial-gradient(circle at 20% 20%,${t.colors[0]}55,transparent 40%),linear-gradient(135deg,#081021,${t.colors[1]}55)`,
                }}
              >
                <div>
                  {Array.from({ length: 25 }).map((_, i) => (
                    <i key={i} />
                  ))}
                </div>
                {data.themeId === t.id && <span>ÉQUIPÉ</span>}
              </div>
              <h3>{t.name}</h3>
              <button
                disabled={!!busy || (!data.ownedThemes.includes(t.id) && data.coins < t.price)}
                onClick={() => void choose(t.id)}
                className={data.ownedThemes.includes(t.id) ? "owned" : ""}
              >
                {data.ownedThemes.includes(t.id) ? (
                  data.themeId === t.id ? (
                    "Équipé"
                  ) : (
                    "Équiper"
                  )
                ) : (
                  <>
                    <Coins />
                    {t.price.toLocaleString("fr-FR")}
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
