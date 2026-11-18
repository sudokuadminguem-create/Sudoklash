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
type CosmeticsData = NonNullable<Cosmetics["state"]>;
const ownedIds: Record<Kind, (data: CosmeticsData) => readonly string[]> = {
  theme: (data) => data.ownedThemes,
  avatar: (data) => data.ownedAvatars,
  frame: (data) => data.unlockedFrames,
};
const equippedId: Record<Kind, (data: CosmeticsData) => string | undefined> = {
  theme: (data) => data.themeId,
  avatar: (data) => data.avatarId,
  frame: (data) => data.frameSelection,
};
const categoryLabels: Record<Kind | "all", string> = {
  all: "Tout",
  frame: "Cadres",
  theme: "Fonds de grille",
  avatar: "Avatars",
};

function purchaseError(e: unknown) {
  return e instanceof Error && (e.message === "not_enough_coins" || e.message === "not_enough_gems")
    ? "Solde insuffisant. Aucun achat effectué."
    : "Achat indisponible. Vérifie ton inventaire avant de réessayer.";
}

function ProductArt({ product: p, data }: { product: Product; data: Cosmetics["state"] }) {
  return (
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
}

function CurrencyPicker({
  currency,
  setCurrency,
}: {
  currency: "coins" | "gems";
  setCurrency: (currency: "coins" | "gems") => void;
}) {
  return (
    <>
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
      <details className="store-help">
        <summary>Comment gagner des Sudokoins ?</summary>
        <p>
          300 à la création du compte · 20 par grille solo terminée · 60 par défi quotidien · 150
          par défi hebdomadaire · 70 par victoire classée. Les parties hors ligne ne rapportent pas
          de monnaie. Tous les achats sont cosmétiques.
        </p>
      </details>
    </>
  );
}

function StoreAccountMessage({
  signedIn,
  hasData,
  cosmetics,
  openAuth,
}: {
  signedIn: boolean;
  hasData: boolean;
  cosmetics: Cosmetics;
  openAuth: () => void;
}) {
  if (!signedIn)
    return (
      <div className="store-message">
        <p>
          Explore la boutique. Connecte-toi pour acheter et conserver tes articles sur ton compte.
        </p>
        <button className="primary" onClick={openAuth}>
          Se connecter
        </button>
      </div>
    );
  if (hasData) return null;
  return (
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
  );
}

function previewActionLabel(busy: boolean, equipped: boolean, owned: boolean, signedIn: boolean) {
  if (busy) return "En cours…";
  if (equipped) return "Équipé";
  if (owned) return "Équiper";
  return signedIn ? "Acheter" : "Se connecter";
}

function PreviewDetails({
  product,
  titleId,
  art,
  owned,
  equipped,
  price,
  balance,
  currencyLabel,
  busy,
  signedIn,
  hasData,
  onClose,
  onAction,
}: {
  product: Product;
  titleId: string;
  art: React.ReactNode;
  owned: boolean;
  equipped: boolean;
  price: number;
  balance: number;
  currencyLabel: string;
  busy: boolean;
  signedIn: boolean;
  hasData: boolean;
  onClose: () => void;
  onAction: () => void;
}) {
  const unaffordable = hasData && !owned && price > balance;
  let status = `${price.toLocaleString("fr-FR")} ${currencyLabel}`;
  if (owned) status = equipped ? "Équipé" : "Possédé";
  return (
    <div className="store-dialog-inner">
      <button
        type="button"
        className="store-dialog-close"
        aria-label="Fermer l’aperçu"
        autoFocus
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
      {art}
      <span className="eyebrow">{labels[product.kind]}</span>
      <h2 id={titleId} className={product.kind === "theme" ? "store-grid-name" : undefined}>
        {product.name}
      </h2>
      <p>{product.description}</p>
      <div className="store-price">{status}</div>
      <button
        type="button"
        className="primary"
        disabled={busy || equipped || (signedIn && (!hasData || (!owned && price > balance)))}
        onClick={onAction}
      >
        {previewActionLabel(busy, equipped, owned, signedIn)}
      </button>
      {unaffordable && (
        <p>
          Il te manque {(price - balance).toLocaleString("fr-FR")} {currencyLabel}.
        </p>
      )}
    </div>
  );
}

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
  const ownedOnly = shelf === "owned";
  const [category, setCategory] = useState<Kind | "all">("all"),
    [busy, setBusy] = useState(""),
    [purchase, setPurchase] = useState<Product | null>(null);
  const [currency, setCurrency] = useState<"coins" | "gems">("coins");
  const currencyLabel = currency === "coins" ? "Sudokoins" : "Sudogemmes";
  const cost = (p: Product) => (currency === "coins" ? p.price : premiumPrice(p.price));
  const data = cosmetics.state;
  const balance = currency === "coins" ? (data?.coins ?? 0) : (data?.gems ?? 0);
  const owned = (p: Product) => !!data && ownedIds[p.kind](data).includes(p.id);
  const equipped = (p: Product) => !!data && equippedId[p.kind](data) === p.id;
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
      notify(purchaseError(e));
    } finally {
      setBusy("");
    }
  };
  const productArt = (p: Product) => <ProductArt product={p} data={data} />;
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
          {!ownedOnly && <CurrencyPicker currency={currency} setCurrency={setCurrency} />}
          <div className="store-filters">
            <div className="store-categories" aria-label="Catégories de boutique">
              {(["all", "frame", "theme", "avatar"] as const).map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {categoryLabels[c]}
                </button>
              ))}
            </div>
          </div>
          <StoreAccountMessage
            signedIn={!!account.user}
            hasData={!!data}
            cosmetics={cosmetics}
            openAuth={openAuth}
          />
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
        onClick={(event) => {
          if (event.target === event.currentTarget) setPreview(null);
        }}
      >
        {preview && (
          <PreviewDetails
            product={preview}
            titleId={previewTitle}
            art={productArt(preview)}
            owned={owned(preview)}
            equipped={equipped(preview)}
            price={cost(preview)}
            balance={balance}
            currencyLabel={currencyLabel}
            busy={!!busy}
            signedIn={!!account.user}
            hasData={!!data}
            onClose={() => setPreview(null)}
            onAction={() => {
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
          />
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
