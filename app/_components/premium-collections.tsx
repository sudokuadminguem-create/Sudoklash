"use client";
import { useState } from "react";
import type { Cosmetics, CosmeticAction } from "@/hooks/use-cosmetics";
import {
  premiumCollections,
  collectionItemId,
  itemPrice,
  bundlePrice,
  type PremiumKind,
} from "@/lib/premium-collections";
import { ProfileCardDisplay } from "./profile-card";
import { VictoryEffect } from "./premium-effects";
import { ConfirmDialog } from "./confirm-dialog";
const labels = {
  frame: "Cadre animé",
  card: "Carte de profil",
  effect: "Effet de victoire",
  bundle: "Collection complète",
};
const equipActions: Record<Exclude<PremiumKind, "bundle">, CosmeticAction> = {
  frame: "equip_frame",
  card: "equip_profile_card",
  effect: "equip_effect",
};
export function PremiumCollections({
  cosmetics,
  signedIn,
  username,
  openAuth,
  notify,
}: {
  cosmetics: Cosmetics;
  signedIn: boolean;
  username: string;
  openAuth: () => void;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(""),
    [purchase, setPurchase] = useState<{ id: string; name: string; price: number } | null>(null),
    [preview, setPreview] = useState<{ id: string; key: number } | null>(null);
  const data = cosmetics.state,
    owned = [
      ...(data?.unlockedFrames ?? []),
      ...(data?.ownedCards ?? []),
      ...(data?.ownedEffects ?? []),
    ];
  const equip = async (collection: string, kind: PremiumKind) => {
    setBusy(collectionItemId(collection, kind));
    try {
      for (const part of kind === "bundle" ? (["frame", "card", "effect"] as const) : [kind])
        await cosmetics.action(equipActions[part], collectionItemId(collection, part));
      notify("Collection mise à jour sur ton compte.");
    } catch {
      notify("Impossible de tout équiper. Tes achats restent dans ton inventaire.");
    } finally {
      setBusy("");
    }
  };
  const buy = async () => {
    if (!purchase) return;
    const p = purchase;
    setPurchase(null);
    setBusy(p.id);
    try {
      await cosmetics.action("buy_premium", p.id, "gems");
      notify(`${p.name} débloqué. Tu peux maintenant l’équiper.`);
    } catch {
      await cosmetics.refresh();
      notify("Achat non confirmé : vérifie ton solde et tes articles avant de réessayer.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="premium-collections">
      <span className="eyebrow">COLLECTIONS SIGNATURE</span>
      <h2>Une identité complète</h2>
      <p>
        Cadre animé, carte de profil lumineuse et célébration de victoire. Achats permanents en
        Sudogemmes, sans avantage de jeu.
      </p>
      <div className="collection-grid">
        {premiumCollections.map((c) => {
          const complete = (["frame", "card", "effect"] as const).every((k) =>
              owned.includes(collectionItemId(c.id, k)),
            ),
            price = bundlePrice(c.id, owned);
          const stats = {
            solo: { games: data?.counts.solo ?? 0 },
            daily: data?.counts.daily ?? 0,
            weekly: data?.counts.weekly ?? 0,
            ranked: {
              points: data?.rankPoints ?? 0,
              wins: data?.counts.wins ?? 0,
              rank: data?.rankName ?? "Bronze",
            },
            bestByDifficulty: [],
          };
          return (
            <article
              className="collection-product"
              key={c.id}
              style={{ "--collection-color": c.color } as React.CSSProperties}
            >
              <div className="collection-preview">
                <ProfileCardDisplay
                  username={username}
                  stats={stats}
                  look={{
                    avatarId: data?.avatarId ?? "nova",
                    customAvatar: data?.customAvatar,
                    frameId: collectionItemId(c.id, "frame"),
                    profileCardId: collectionItemId(c.id, "card"),
                    profileTitleId: data?.profileTitleId ?? "none",
                  }}
                />
              </div>
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <div className="collection-demo">
                {preview?.id === c.id ? (
                  <VictoryEffect
                    key={preview.key}
                    won
                    previewId={collectionItemId(c.id, "effect")}
                  />
                ) : (
                  <span>Découvrir la célébration</span>
                )}
              </div>
              <button onClick={() => setPreview({ id: c.id, key: Date.now() })}>
                Aperçu de victoire
              </button>
              <div className="collection-actions">
                {(["frame", "card", "effect"] as const).map((kind) => {
                  const id = collectionItemId(c.id, kind),
                    has = owned.includes(id),
                    active =
                      data &&
                      (kind === "frame"
                        ? data.frameSelection
                        : kind === "card"
                          ? data.profileCardId
                          : data.victoryEffectId) === id;
                  return (
                    <div key={id}>
                      <span>
                        {labels[kind]}
                        <small>{has ? "Possédé" : `${itemPrice[kind]} Sudogemmes`}</small>
                      </span>
                      <button
                        disabled={
                          !!busy ||
                          !!active ||
                          (signedIn && (!data || (!has && (data.gems ?? 0) < itemPrice[kind])))
                        }
                        onClick={() => {
                          if (!signedIn) {
                            openAuth();
                            return;
                          }
                          if (has) void equip(c.id, kind);
                          else
                            setPurchase({
                              id,
                              name: `${labels[kind]} · ${c.name}`,
                              price: itemPrice[kind],
                            });
                        }}
                      >
                        {active ? "Équipé" : has ? "Équiper" : "Acheter"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                className="primary"
                disabled={
                  !!busy || (signedIn && (!data || (!complete && (data.gems ?? 0) < price)))
                }
                onClick={() => {
                  if (!signedIn) {
                    openAuth();
                    return;
                  }
                  if (complete) void equip(c.id, "bundle");
                  else setPurchase({ id: collectionItemId(c.id, "bundle"), name: c.name, price });
                }}
              >
                {complete ? "Équiper toute la collection" : `Collection · ${price} Sudogemmes`}
              </button>
              <small>
                {complete
                  ? "Les trois éléments sont dans ton inventaire."
                  : price === 190
                    ? "190 au lieu de 240 Sudogemmes pour les trois éléments."
                    : "Prix réduit : seuls les éléments manquants sont facturés."}
              </small>
              {data && !complete && data.gems < price && (
                <small>Il te manque {price - data.gems} Sudogemmes pour le pack.</small>
              )}
            </article>
          );
        })}
      </div>
      {data && (
        <button
          onClick={() =>
            void cosmetics
              .action("equip_effect", "none")
              .then(() => notify("Effet de victoire désactivé"))
              .catch(() => notify("Impossible de désactiver l’effet"))
          }
        >
          Désactiver mon effet de victoire
        </button>
      )}
      {purchase && data && (
        <ConfirmDialog
          title={`Acheter ${purchase.name} ?`}
          message={`${purchase.price} Sudogemmes. Solde après achat : ${Math.max(0, (data.gems ?? 0) - purchase.price)}. Achat permanent ; tu pourras équiper les éléments ensuite.`}
          confirmLabel={`Acheter · ${purchase.price} Sudogemmes`}
          onConfirm={() => void buy()}
          onCancel={() => setPurchase(null)}
        />
      )}
    </section>
  );
}
