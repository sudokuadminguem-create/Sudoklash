"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Coins, Check, ShoppingBag, Gem, Heart, X, Sparkles, Grid2X2 } from "lucide-react";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics, CosmeticAction, CosmeticState } from "@/hooks/use-cosmetics";
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
type Shelf = "catalog" | "collections" | "owned" | "gems" | "support";
type Currency = "coins" | "gems";
type Category = Kind | "all";
const categoryLabels: Record<Category, string> = {
  all: "Tout",
  frame: "Cadres",
  theme: "Fonds de grille",
  avatar: "Avatars",
};
const shelves = [
  ["catalog", "Cosmétiques", Grid2X2],
  ["collections", "Collections", Sparkles],
  ["owned", "Mes articles", ShoppingBag],
  ["gems", "Sudogemmes", Gem],
  ["support", "Dons", Heart],
] as const;

/** The shelf a payment return lands on: the one its session or cancellation came from. */
function shelfFromQuery(search: string): Shelf | null {
  const query = new URLSearchParams(search);
  if (query.has("support_session") || query.has("support_cancelled")) return "support";
  if (query.has("premium_session") || query.has("premium_cancelled")) return "gems";
  return null;
}

function ownedIds(data: CosmeticState, kind: Kind) {
  if (kind === "theme") return data.ownedThemes;
  if (kind === "avatar") return data.ownedAvatars;
  return data.unlockedFrames;
}

function equippedId(data: CosmeticState, kind: Kind) {
  if (kind === "theme") return data.themeId;
  if (kind === "avatar") return data.avatarId;
  return data.frameSelection;
}

const isOwned = (data: CosmeticState | null, p: Product) =>
  !!data && ownedIds(data, p.kind).includes(p.id);
const isEquipped = (data: CosmeticState | null, p: Product) =>
  !!data && equippedId(data, p.kind) === p.id;

function purchaseError(error: unknown) {
  const short =
    error instanceof Error &&
    (error.message === "not_enough_coins" || error.message === "not_enough_gems");
  return short
    ? "Solde insuffisant. Aucun achat effectué."
    : "Achat indisponible. Vérifie ton inventaire avant de réessayer.";
}

/** What the preview's main button does next, in the words it shows. */
function previewActionLabel(busy: boolean, equipped: boolean, owned: boolean, signedIn: boolean) {
  if (busy) return "En cours…";
  if (equipped) return "Équipé";
  if (owned) return "Équiper";
  return signedIn ? "Acheter" : "Se connecter";
}

function ProductArt({
  product: p,
  data,
}: Readonly<{ product: Product; data: CosmeticState | null }>) {
  const background = p.colors
    ? `radial-gradient(circle at 20% 20%,${p.colors[0]}66,transparent 65%),linear-gradient(135deg,#081021,${p.colors[1]}55)`
    : undefined;
  return (
    <div
      className={`store-preview store-preview-${p.kind}`}
      style={background ? { background } : undefined}
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

/** Pricing shared by the cards, the preview and the purchase confirmation. */
type Pricing = {
  data: CosmeticState | null;
  balance: number;
  currencyLabel: string;
  cost: (p: Product) => number;
};

function ProductCard({
  product: p,
  pricing,
  onOpen,
}: Readonly<{
  product: Product;
  pricing: Pricing;
  onOpen: () => void;
}>) {
  const { data, balance, currencyLabel, cost } = pricing;
  const has = isOwned(data, p);
  const missing = Math.max(0, cost(p) - balance);
  const price = p.price === 0 ? "Inclus" : `${cost(p).toLocaleString("fr-FR")} ${currencyLabel}`;
  return (
    <article className="store-product" data-kind={p.kind}>
      <button
        type="button"
        className="store-preview-trigger"
        aria-label={`Voir ${p.name}`}
        onClick={onOpen}
      >
        <ProductArt product={p} data={data} />
        {has && (
          <span className="store-owned">
            <Check aria-hidden="true" />
            {isEquipped(data, p) ? "Équipé" : "Possédé"}
          </span>
        )}
      </button>
      <div className="store-product-body">
        <small>{labels[p.kind]}</small>
        <h3>{p.name}</h3>

        <div className="store-price">
          <Coins aria-hidden="true" />
          {price}
        </div>
        <button type="button" className="store-equip" onClick={onOpen}>
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
}

function PreviewDialog({
  preview,
  pricing,
  busy,
  signedIn,
  onClose,
  onChoose,
}: Readonly<{
  preview: Product | null;
  pricing: Pricing;
  busy: boolean;
  signedIn: boolean;
  onClose: () => void;
  onChoose: (p: Product) => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previewTitle = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const element = dialog.current;
    if (preview && element && !element.open) element.showModal();
    else if (!preview && element?.open) element.close();
  }, [preview]);
  // A click on the backdrop closes the preview; the keyboard closes it with Escape (onCancel).
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === element) onCloseRef.current();
    };
    element.addEventListener("click", closeOnBackdrop);
    return () => element.removeEventListener("click", closeOnBackdrop);
  }, []);
  return (
    <dialog
      ref={dialog}
      className="store-dialog"
      aria-labelledby={previewTitle}
      onCancel={onClose}
      onClose={onClose}
    >
      {preview && (
        <PreviewContent
          preview={preview}
          pricing={pricing}
          busy={busy}
          signedIn={signedIn}
          titleId={previewTitle}
          onClose={onClose}
          onChoose={onChoose}
        />
      )}
    </dialog>
  );
}

function PreviewContent({
  preview,
  pricing,
  busy,
  signedIn,
  titleId,
  onClose,
  onChoose,
}: Readonly<{
  preview: Product;
  pricing: Pricing;
  busy: boolean;
  signedIn: boolean;
  titleId: string;
  onClose: () => void;
  onChoose: (p: Product) => void;
}>) {
  const { data, balance, currencyLabel, cost } = pricing;
  const owned = isOwned(data, preview);
  const equipped = isEquipped(data, preview);
  const shortfall = !owned && cost(preview) > balance;
  let status = `${cost(preview).toLocaleString("fr-FR")} ${currencyLabel}`;
  if (owned) status = equipped ? "Équipé" : "Possédé";
  return (
    <div className="store-dialog-inner">
      <button
        type="button"
        className="store-dialog-close"
        aria-label="Fermer l’aperçu"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
      <ProductArt product={preview} data={data} />
      <span className="eyebrow">{labels[preview.kind]}</span>
      <h2 id={titleId} className={preview.kind === "theme" ? "store-grid-name" : undefined}>
        {preview.name}
      </h2>
      <p>{preview.description}</p>
      <div className="store-price">{status}</div>
      <button
        type="button"
        className="primary"
        disabled={busy || equipped || (signedIn && (!data || shortfall))}
        onClick={() => onChoose(preview)}
      >
        {previewActionLabel(busy, equipped, owned, signedIn)}
      </button>
      {data && shortfall && (
        <p>
          Il te manque {(cost(preview) - balance).toLocaleString("fr-FR")} {currencyLabel}.
        </p>
      )}
    </div>
  );
}

function CurrencyPicker({
  currency,
  setCurrency,
}: Readonly<{
  currency: Currency;
  setCurrency: (value: Currency) => void;
}>) {
  return (
    <>
      <div className="store-categories" aria-label="Monnaie pour les articles">
        {(
          [
            ["coins", "Payer en Sudokoins"],
            ["gems", "Payer en Sudogemmes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={currency === id}
            className={currency === id ? "active" : ""}
            onClick={() => setCurrency(id)}
          >
            {label}
          </button>
        ))}
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

function AccountNotice({
  cosmetics,
  account,
  openAuth,
}: Readonly<{
  cosmetics: Cosmetics;
  account: Account;
  openAuth: () => void;
}>) {
  if (!account.user)
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
  if (cosmetics.state) return null;
  return (
    <output className="store-message">
      <p>
        {cosmetics.loading
          ? "Chargement de ton solde…"
          : "Ton solde est indisponible pour le moment."}
      </p>
      <button onClick={() => void cosmetics.refresh()} disabled={cosmetics.loading}>
        Réessayer
      </button>
    </output>
  );
}

function CosmeticsShelf({
  ownedOnly,
  category,
  setCategory,
  currency,
  setCurrency,
  notify,
  cosmetics,
  account,
  openAuth,
}: Readonly<{
  ownedOnly: boolean;
  category: Category;
  setCategory: (value: Category) => void;
  currency: Currency;
  setCurrency: (value: Currency) => void;
  notify: (value: string) => void;
  cosmetics: Cosmetics;
  account: Account;
  openAuth: () => void;
}>) {
  const [preview, setPreview] = useState<Product | null>(null),
    [busy, setBusy] = useState(""),
    [purchase, setPurchase] = useState<Product | null>(null);
  const data = cosmetics.state;
  const coins = currency === "coins";
  const pricing: Pricing = {
    data,
    balance: (coins ? data?.coins : data?.gems) ?? 0,
    currencyLabel: coins ? "Sudokoins" : "Sudogemmes",
    cost: (p) => (coins ? p.price : premiumPrice(p.price)),
  };
  const { balance, currencyLabel, cost } = pricing;
  const products = catalog.filter(
    (p) => (category === "all" || p.kind === category) && (!ownedOnly || isOwned(data, p)),
  );
  const plural = products.length > 1 ? "s" : "";
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
  const choose = (p: Product) => {
    if (!account.user) {
      setPreview(null);
      openAuth();
    } else if (isOwned(data, p)) void equip(p);
    else {
      setPurchase(p);
      setPreview(null);
    }
  };
  return (
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
      <AccountNotice cosmetics={cosmetics} account={account} openAuth={openAuth} />
      <p className="store-count">
        {products.length} article{plural}
        {ownedOnly ? ` possédé${plural}` : ""}
      </p>
      {products.length ? (
        <div className="store-products">
          {products.map((p) => (
            <ProductCard
              key={`${p.kind}:${p.id}`}
              product={p}
              pricing={pricing}
              onOpen={() => setPreview(p)}
            />
          ))}
        </div>
      ) : (
        <p className="store-message">
          {account.user
            ? "Aucun article dans ce rayon pour le moment."
            : "Connecte-toi pour retrouver tes articles."}
        </p>
      )}
      <PreviewDialog
        preview={preview}
        pricing={pricing}
        busy={!!busy}
        signedIn={!!account.user}
        onClose={() => setPreview(null)}
        onChoose={choose}
      />
      {purchase && data && (
        <ConfirmDialog
          title={`Acheter ${purchase.name} ?`}
          message={`Cet achat permanent coûte ${cost(purchase).toLocaleString("fr-FR")} ${currencyLabel}. Solde après achat : ${Math.max(0, balance - cost(purchase)).toLocaleString("fr-FR")} ${currencyLabel}. Tu pourras ensuite équiper cet article.`}
          confirmLabel={`Acheter · ${cost(purchase).toLocaleString("fr-FR")} ${currencyLabel}`}
          onConfirm={() => void buy(purchase)}
          onCancel={() => setPurchase(null)}
        />
      )}
    </>
  );
}

export function Shop({
  notify,
  cosmetics,
  account,
  openAuth,
}: Readonly<{
  notify: (value: string) => void;
  cosmetics: Cosmetics;
  account: Account;
  openAuth: () => void;
}>) {
  const [shelf, setShelf] = useState<Shelf>("catalog");
  const [category, setCategory] = useState<Category>("all");
  const [currency, setCurrency] = useState<Currency>("coins");
  useEffect(() => {
    const landing = shelfFromQuery(location.search);
    if (landing) setShelf(landing);
  }, []);
  const data = cosmetics.state;
  const signedIn = !!account.user;
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
        {shelves.map(([id, label, Icon]) => (
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
      {shelf === "support" && <SupportShop signedIn={signedIn} openAuth={openAuth} />}
      {shelf === "gems" && (
        <PremiumPacks signedIn={signedIn} openAuth={openAuth} cosmetics={cosmetics} />
      )}
      {shelf === "collections" && (
        <PremiumCollections
          cosmetics={cosmetics}
          signedIn={signedIn}
          username={account.profile?.username ?? "Ton profil"}
          openAuth={openAuth}
          notify={notify}
        />
      )}
      {(shelf === "catalog" || shelf === "owned") && (
        <CosmeticsShelf
          ownedOnly={shelf === "owned"}
          category={category}
          setCategory={setCategory}
          currency={currency}
          setCurrency={setCurrency}
          notify={notify}
          cosmetics={cosmetics}
          account={account}
          openAuth={openAuth}
        />
      )}
    </div>
  );
}
