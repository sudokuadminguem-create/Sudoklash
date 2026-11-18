export const premiumCollections = [
  {
    id: "dragon",
    name: "Dragon céleste",
    element: "dragon",
    color: "#64f6bd",
    accent: "#d8aa43",
    symbol: "🐉",
    description: "Énergie émeraude, ornements draconiques et éclat doré.",
  },
  {
    id: "samurai",
    name: "Samouraï Sakura",
    element: "samurai",
    color: "#ffb3df",
    accent: "#a0406d",
    symbol: "🌸",
    description: "Pétales roses, emblème de samouraï et lumière du printemps.",
  },
  {
    id: "cosmic",
    name: "Voyageur cosmique",
    element: "nebula",
    color: "#a8caff",
    accent: "#945aff",
    symbol: "✦",
    description: "Un portail lumineux, des étoiles et des reflets violets.",
  },
  {
    id: "pirate",
    name: "Capitaine des abysses",
    element: "pirate",
    color: "#5bdfef",
    accent: "#e8b765",
    symbol: "⚓",
    description: "Ornements de capitaine, océan turquoise et éclats de trésor.",
  },
] as const;
export type PremiumKind = "frame" | "card" | "effect" | "bundle";
export const itemPrice = { frame: 90, card: 80, effect: 70, bundle: 190 } as const;
export const collectionItemId = (collection: string, kind: PremiumKind) =>
  `premium-${collection}-${kind}`;
export function parseCollectionItem(id: string) {
  for (const collection of premiumCollections)
    for (const kind of ["frame", "card", "effect", "bundle"] as const)
      if (collectionItemId(collection.id, kind) === id)
        return { collection, kind, price: itemPrice[kind] };
  return null;
}
export function premiumOwned(purchases: string[]) {
  const owned = new Set<string>();
  for (const item of purchases) {
    if (!item.startsWith("premium:")) continue;
    const id = item.slice(8),
      product = parseCollectionItem(id);
    if (!product) continue;
    if (product.kind === "bundle")
      for (const kind of ["frame", "card", "effect"] as const)
        owned.add(collectionItemId(product.collection.id, kind));
    else owned.add(id);
  }
  return owned;
}
/** A partially owned collection charges only its remaining components, at the bundle discount. */
export function bundlePrice(collection: string, owned: Iterable<string>) {
  const items = new Set(owned);
  const remaining = (["frame", "card", "effect"] as const).reduce(
    (sum, kind) => sum + (items.has(collectionItemId(collection, kind)) ? 0 : itemPrice[kind]),
    0,
  );
  return Math.ceil(
    (remaining * itemPrice.bundle) / (itemPrice.frame + itemPrice.card + itemPrice.effect),
  );
}
