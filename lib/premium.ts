export const premiumPacks = [
  { id: "pocket", name: "Découverte", cents: 99, gems: 100 },
  { id: "starter", name: "Petit pack", cents: 200, gems: 220 },
  { id: "collector", name: "Collectionneur", cents: 500, gems: 600 },
  { id: "deluxe", name: "Grand pack", cents: 1000, gems: 1300 },
] as const;
export const premiumPrice = (coins: number) => Math.ceil(coins / 10);
export const euroPrice = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
