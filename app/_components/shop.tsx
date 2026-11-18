"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Coins, Check, ShoppingBag, Gem, Heart, X, Sparkles, Grid2X2 } from "lucide-react";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics, CosmeticAction } from "@/hooks/use-cosmetics";
import { gridThemes, shopAvatars, shopFrames } from "@/lib/cosmetics";
import { PlayerAvatar } from "./player-cosmetics";
import { premiumPrice } from "@/lib/premium";
import { PremiumCollections } from "./premium-collections";
import { SupportShop } from "./support";
import { PremiumPacks } from "./premium-packs";
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
  const [shelf, setShelf] = useState<"catalog" | "collections" | "owned" | "gems" | "support">("catalog");
  const [preview, setPreview] = useState<Product | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previewTitle = useId();
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.has("support_session") || query.has("support_cancelled")) setShelf("support");
    else if (query.has("premium_session") || query.has("premium_cancelled")) setShelf("gems");
  }, []);
  useEffect(() => {
    if (preview && dialog.current && !dialog.current.open) dialog.current.showModal();
    else if (!preview && dialog.current?.open) dialog.current.close();
  }, [preview]);
  // A click on the backdrop closes the preview; the keyboard closes it with Escape (onCancel).
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === element) setPreview(null);
    };
    element.addEventListener("click", closeOnBackdrop);
    return () => element.removeEventListener("click", closeOnBackdrop);
  }, []);
  const ownedOnly = shelf === "owned";
  const [category, setCategory] = useState<Kind | "all">("all"),
    [busy, setBusy] = useState(""),
    [purchase, setPurchase] = useState<Product | null>(null);
  const [currency, setCurrency] = useState<"coins" | "gems">("coins");
  const currencyLabel = currency === "coins" ? "Sudokoins" : "Sudogemmes";
  const cost = (p: Product) => (currency === "coins" ? p.price : premiumPrice(p.price));
  const data = cosmetics.state;
  const balance = currency === "coins" ? (data?.coins ?? 0) : (data?.gems ?? 0);
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
      await cosmetics.action(actions[p.kind].buy, p.id, currency);
      notify(`${p.name} acheté ! Retrouve-le dans « Mes articles » et équipe-le quand tu veux.`);
    } catch (e) {
      notify(
        e instanceof Error && (e.message === "not_enough_coins" || e.message === "not_enough_gems")
          ? "Solde insuffisant. Aucun achat effectué."
          : "Achat indisponible. Vérifie ton inventaire avant de réessayer.",
      );
    } finally {
      setBusy("");
    }
  };
  const productArt = (p: Product) => (
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
    </div>
  );
  return (
    <div className="shop-catalog">
      <header className="store-header">
        <div>
          <span className="eyebrow">SUDOKU CLASH</span>
          <h2>Boutique</h2>
          <p>Personnalise ton avatar et tes grilles.</p>
        </div>
        <div className="store-balances" aria-label="Tes soldes">
          <span>
            <Coins aria-hidden="true" />
            <b>{data?.coins.toLocaleString("fr-FR") ?? "—"}</b> Sudokoins
          </span>
          <span>
            <Gem aria-hidden="true" />
            <b>{data?.gems.toLocaleString("fr-FR") ?? "—"}</b> Sudogemmes
          </span>
        </div>
      </header>
      <nav className="store-shelves" aria-label="Rayons de la boutique">
        {(
          [
            ["catalog", "Cosmétiques", Grid2X2],
            ["collections", "Collections", Sparkles],
            ["owned", "Mes articles", ShoppingBag],
            ["gems", "Sudogemmes", Gem],
            ["support", "Dons", Heart],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            aria-current={shelf === id ? "page" : undefined}
            onClick={() => {
              setShelf(id);
              setCategory("all");
            }}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      {shelf === "support" && <SupportShop signedIn={!!account.user} openAuth={openAuth} />}
      {shelf === "gems" && (
        <PremiumPacks signedIn={!!account.user} openAuth={openAuth} cosmetics={cosmetics} />
      )}
      {shelf === "collections" && (
        <PremiumCollections
          cosmetics={cosmetics}
          signedIn={!!account.user}
          username={account.profile?.username ?? "Ton profil"}
          openAuth={openAuth}
          notify={notify}
        />
      )}
      {(shelf === "catalog" || shelf === "owned") && (
        <>
          {!ownedOnly && (
            <div className="store-categories" aria-label="Monnaie pour les articles">
              <button
                aria-pressed={currency === "coins"}
                className={currency === "coins" ? "active" : ""}
                onClick={() => setCurrency("coins")}
              >
                Payer en Sudokoins
              </button>
              <button
                aria-pressed={currency === "gems"}
                className={currency === "gems" ? "active" : ""}
                onClick={() => setCurrency("gems")}
              >
                Payer en Sudogemmes
              </button>
            </div>
          )}
          {!ownedOnly && (
            <details className="store-help">
              <summary>Comment gagner des Sudokoins ?</summary>
              <p>
                300 à la création du compte · 20 par grille solo terminée · 60 par défi quotidien ·
                150 par défi hebdomadaire · 70 par victoire classée. Les parties hors ligne ne
                rapportent pas de monnaie. Tous les achats sont cosmétiques.
              </p>
            </details>
          )}
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
          </div>
          {!account.user && (
            <div className="store-message">
              <p>
                Explore la boutique. Connecte-toi pour acheter et conserver tes articles sur ton
                compte.
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
            <p className="store-message">
              {account.user
                ? "Aucun article dans ce rayon pour le moment."
                : "Connecte-toi pour retrouver tes articles."}
            </p>
          ) : (
            <div className="store-products">
              {products.map((p) => {
                const has = owned(p),
                  selected = equipped(p),
                  missing = Math.max(0, cost(p) - balance);
                return (
                  <article className="store-product" data-kind={p.kind} key={`${p.kind}:${p.id}`}>
                    <button
                      type="button"
                      className="store-preview-trigger"
                      aria-label={`Voir ${p.name}`}
                      onClick={() => setPreview(p)}
                    >
                      {productArt(p)}
                      {has && (
                        <span className="store-owned">
                          <Check aria-hidden="true" />
                          {selected ? "Équipé" : "Possédé"}
                        </span>
                      )}
                    </button>
                    <div className="store-product-body">
                      <small>{labels[p.kind]}</small>
                      <h3>{p.name}</h3>

                      <div className="store-price">
                        <Coins aria-hidden="true" />
                        {p.price === 0
                          ? "Inclus"
                          : `${cost(p).toLocaleString("fr-FR")} ${currencyLabel}`}
                      </div>
                      <button type="button" className="store-equip" onClick={() => setPreview(p)}>
                        Voir l’article
                      </button>
                      {data && !has && missing > 0 && (
                        <small className="store-shortfall">
                          Il te manque {missing.toLocaleString("fr-FR")} {currencyLabel}
                        </small>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="store-dialog"
        aria-labelledby={previewTitle}
        onCancel={() => setPreview(null)}
        onClose={() => setPreview(null)}
      >
        {preview && (
          <div className="store-dialog-inner">
            <button
              type="button"
              className="store-dialog-close"
              aria-label="Fermer l’aperçu"
              autoFocus
              onClick={() => setPreview(null)}
            >
              <X aria-hidden="true" />
            </button>
            {productArt(preview)}
            <span className="eyebrow">{labels[preview.kind]}</span>
            <h2 id={previewTitle} className={preview.kind === "theme" ? "store-grid-name" : undefined}>{preview.name}</h2>
            <p>{preview.description}</p>
            <div className="store-price">
              {owned(preview)
                ? equipped(preview)
                  ? "Équipé"
                  : "Possédé"
                : `${cost(preview).toLocaleString("fr-FR")} ${currencyLabel}`}
            </div>
            <button
              type="button"
              className="primary"
              disabled={
                !!busy ||
                equipped(preview) ||
                (!!account.user && (!data || (!owned(preview) && cost(preview) > balance)))
              }
              onClick={() => {
                if (!account.user) {
                  setPreview(null);
                  openAuth();
                  return;
                }
                if (owned(preview)) void equip(preview);
                else {
                  setPurchase(preview);
                  setPreview(null);
                }
              }}
            >
              {busy
                ? "En cours…"
                : equipped(preview)
                  ? "Équipé"
                  : owned(preview)
                    ? "Équiper"
                    : !account.user
                      ? "Se connecter"
                      : "Acheter"}
            </button>
            {data && !owned(preview) && cost(preview) > balance && (
              <p>
                Il te manque {(cost(preview) - balance).toLocaleString("fr-FR")} {currencyLabel}.
              </p>
            )}
          </div>
        )}
      </dialog>
      {purchase && data && (
        <ConfirmDialog
          title={`Acheter ${purchase.name} ?`}
          message={`Cet achat permanent coûte ${cost(purchase).toLocaleString("fr-FR")} ${currencyLabel}. Solde après achat : ${Math.max(0, balance - cost(purchase)).toLocaleString("fr-FR")} ${currencyLabel}. Tu pourras ensuite équiper cet article.`}
          confirmLabel={`Acheter · ${cost(purchase).toLocaleString("fr-FR")} ${currencyLabel}`}
          onConfirm={() => void buy(purchase)}
          onCancel={() => setPurchase(null)}
        />
      )}
    </div>
  );
}
