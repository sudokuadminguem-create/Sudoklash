"use client";
import { useState } from "react";
import { Coins, Check, ShoppingBag } from "lucide-react";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics, CosmeticAction } from "@/hooks/use-cosmetics";
import { gridThemes, shopAvatars, shopFrames } from "@/lib/cosmetics";
import { PlayerAvatar } from "./player-cosmetics";
import { ConfirmDialog } from "./confirm-dialog";
import "../shop-catalog.css";

type Kind = "theme" | "avatar" | "frame";
type Product = {
  id: string;
  name: string;
  price: number;
  kind: Kind;
  description: string;
  colors?: readonly string[];
};
const themeDescriptions: Record<string, string> = {
  ocean: "Le fond turquoise et bleu inclus avec ton compte.",
  tokyo: "Des accents cyan et magenta pour une ambiance néon.",
  galaxy: "Un fond violet cosmique avec des reflets roses.",
  "sakura-grid": "Une palette rose tendre inspirée des fleurs de cerisier.",
  circuit: "Une ambiance verte lumineuse pour ta grille.",
  obsidian: "Un fond bleu ardoise discret, aux tons sombres.",
};
const catalog: Product[] = [
  ...shopFrames.map((p) => ({ ...p, kind: "frame" as const })),
  ...gridThemes.map((p) => ({
    ...p,
    kind: "theme" as const,
    description: themeDescriptions[p.id],
  })),
  ...shopAvatars.map((p) => ({
    ...p,
    kind: "avatar" as const,
    description: `L’avatar ${p.name}, utilisable sur ton profil, dans tes duels et les classements.`,
  })),
];
const labels: Record<Kind, string> = {
  theme: "Fond de grille",
  avatar: "Avatar",
  frame: "Cadre d’avatar",
};
const actions: Record<Kind, { buy: CosmeticAction; equip: CosmeticAction }> = {
  theme: { buy: "buy_theme", equip: "equip_theme" },
  avatar: { buy: "buy_avatar", equip: "equip_avatar" },
  frame: { buy: "buy_frame", equip: "equip_frame" },
};
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
  const [category, setCategory] = useState<Kind | "all">("all"),
    [ownedOnly, setOwnedOnly] = useState(false),
    [busy, setBusy] = useState(""),
    [purchase, setPurchase] = useState<Product | null>(null);
  const data = cosmetics.state;
  const owned = (p: Product) =>
    !!data &&
    (p.kind === "theme"
      ? data.ownedThemes
      : p.kind === "avatar"
        ? data.ownedAvatars
        : data.unlockedFrames
    ).includes(p.id);
  const equipped = (p: Product) =>
    !!data &&
    (p.kind === "theme"
      ? data.themeId
      : p.kind === "avatar"
        ? data.avatarId
        : data.frameSelection) === p.id;
  const products = catalog.filter(
    (p) => (category === "all" || p.kind === category) && (!ownedOnly || owned(p)),
  );
  const equip = async (p: Product) => {
    setBusy(p.id);
    try {
      await cosmetics.action(actions[p.kind].equip, p.id);
      notify(`${p.name} équipé`);
    } catch {
      notify("Impossible d’équiper cet article. Réessaie.");
    } finally {
      setBusy("");
    }
  };
  const buy = async (p: Product) => {
    setPurchase(null);
    setBusy(p.id);
    try {
      await cosmetics.action(actions[p.kind].buy, p.id);
      notify(`${p.name} acheté ! Retrouve-le dans « Mes articles » et équipe-le quand tu veux.`);
    } catch (e) {
      notify(
        e instanceof Error && e.message === "not_enough_coins"
          ? "Solde insuffisant. Aucun achat effectué."
          : "Achat indisponible. Vérifie ton inventaire avant de réessayer.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="shop-catalog">
      <header className="store-header">
        <div>
          <span className="eyebrow">BOUTIQUE SUDOKU CLASH</span>
          <h2>Choisis ton style</h2>
          <p>
            Cadres, avatars et fonds de grille. Achats permanents en Sudokoins, la monnaie gagnée en
            jouant.
          </p>
        </div>
        <div className="store-wallet">
          <Coins aria-hidden="true" />
          <span>
            Ton solde<b>{data ? data.coins.toLocaleString("fr-FR") : "—"}</b>Sudokoins
          </span>
        </div>
      </header>
      <details className="store-help">
        <summary>Comment gagner des Sudokoins ?</summary>
        <p>
          300 à la création du compte · 20 par grille solo terminée · 60 par défi quotidien · 150
          par défi hebdomadaire · 70 par victoire classée. Les parties hors ligne ne rapportent pas
          de monnaie. Tous les achats sont cosmétiques.
        </p>
      </details>
      <div className="store-filters">
        <div className="store-categories" aria-label="Catégories de boutique">
          {(["all", "frame", "theme", "avatar"] as const).map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c === "all"
                ? "Tout"
                : c === "frame"
                  ? "Cadres"
                  : c === "theme"
                    ? "Fonds de grille"
                    : "Avatars"}
            </button>
          ))}
        </div>
        <label>
          <input
            type="checkbox"
            checked={ownedOnly}
            disabled={!data}
            onChange={(e) => setOwnedOnly(e.target.checked)}
          />
          <ShoppingBag aria-hidden="true" />
          Mes articles
        </label>
      </div>
      {!account.user && (
        <div className="store-message">
          <p>
            Explore la boutique. Connecte-toi pour acheter et conserver tes articles sur ton compte.
          </p>
          <button className="primary" onClick={openAuth}>
            Se connecter
          </button>
        </div>
      )}
      {account.user && !data && (
        <div className="store-message" role="status">
          <p>
            {cosmetics.loading
              ? "Chargement de ton solde…"
              : "Ton solde est indisponible pour le moment."}
          </p>
          <button onClick={() => void cosmetics.refresh()} disabled={cosmetics.loading}>
            Réessayer
          </button>
        </div>
      )}
      <p className="store-count">
        {products.length} article{products.length > 1 ? "s" : ""}
        {ownedOnly ? " possédé" + (products.length > 1 ? "s" : "") : ""}
      </p>
      {!products.length ? (
        <p className="store-message">Aucun article acheté dans cette catégorie pour le moment.</p>
      ) : (
        <div className="store-products">
          {products.map((p) => {
            const has = owned(p),
              selected = equipped(p),
              missing = Math.max(0, p.price - (data?.coins ?? 0));
            return (
              <article className="store-product" key={`${p.kind}:${p.id}`}>
                <div
                  className={`store-preview store-preview-${p.kind}`}
                  style={
                    p.colors
                      ? {
                          background: `radial-gradient(circle at 20% 20%,${p.colors[0]}66,transparent 65%),linear-gradient(135deg,#081021,${p.colors[1]}55)`,
                        }
                      : undefined
                  }
                >
                  {p.kind === "theme" ? (
                    <div className="store-mini-grid" aria-hidden="true">
                      {Array.from({ length: 81 }, (_, i) => (
                        <span key={i}>{i % 4 === 0 ? ((i * 7) % 9) + 1 : ""}</span>
                      ))}
                    </div>
                  ) : (
                    <PlayerAvatar
                      avatarId={p.kind === "avatar" ? p.id : (data?.avatarId ?? "nova")}
                      image={p.kind === "frame" ? data?.customAvatar : undefined}
                      frameId={p.kind === "frame" ? p.id : "none"}
                      size="large"
                    />
                  )}
                  {has && (
                    <span className="store-owned">
                      <Check aria-hidden="true" />
                      {selected ? "Équipé" : "Possédé"}
                    </span>
                  )}
                </div>
                <div className="store-product-body">
                  <small>{labels[p.kind]}</small>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <div className="store-price">
                    <Coins aria-hidden="true" />
                    {p.price === 0 ? "Inclus" : `${p.price.toLocaleString("fr-FR")} Sudokoins`}
                  </div>
                  <button
                    className={has ? "store-equip" : "primary"}
                    disabled={
                      !!busy || selected || (!!account.user && (!data || (!has && missing > 0)))
                    }
                    onClick={() => {
                      if (!account.user) {
                        openAuth();
                        return;
                      }
                      if (has) void equip(p);
                      else setPurchase(p);
                    }}
                  >
                    {busy === p.id
                      ? "En cours…"
                      : selected
                        ? "Équipé"
                        : has
                          ? "Équiper"
                          : !account.user
                            ? "Se connecter pour acheter"
                            : "Acheter"}
                  </button>
                  {data && !has && missing > 0 && (
                    <small className="store-shortfall">
                      Il te manque {missing.toLocaleString("fr-FR")} Sudokoins
                    </small>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {purchase && data && (
        <ConfirmDialog
          title={`Acheter ${purchase.name} ?`}
          message={`Cet achat permanent coûte ${purchase.price.toLocaleString("fr-FR")} Sudokoins. Solde après achat : ${Math.max(0, data.coins - purchase.price).toLocaleString("fr-FR")} Sudokoins. Tu pourras ensuite équiper cet article.`}
          confirmLabel={`Acheter · ${purchase.price.toLocaleString("fr-FR")} Sudokoins`}
          onConfirm={() => void buy(purchase)}
          onCancel={() => setPurchase(null)}
        />
      )}
    </div>
  );
}
