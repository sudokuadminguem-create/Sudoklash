// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { pickLabel, uploadLabel } from "@/app/_components/player-cosmetics";
import { buyLabel, bundleHint } from "@/app/_components/premium-collections";
import { rewardLabel } from "@/app/_components/profile-card";
import { startLabel } from "@/app/_components/private-lobby";
import { emptyMessage } from "@/app/_components/achievement-board";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));

describe("cosmetic captions", () => {
  it("puts equipped before available and locked", () => {
    expect(pickLabel(true, true, "Choisir", "Niveau 5")).toBe("Équipé");
    expect(pickLabel(false, true, "Choisir", "Niveau 5")).toBe("Choisir");
    expect(pickLabel(false, false, "Choisir", "Niveau 5")).toBe("Niveau 5");
  });

  it("describes the custom avatar upload", () => {
    expect(uploadLabel(true, true)).toBe("Envoi en cours…");
    expect(uploadLabel(false, true)).toBe("Changer mon image");
    expect(uploadLabel(false, false)).toBe("Importer une image");
  });

  it("labels premium items and bundles", () => {
    expect(buyLabel(true, true)).toBe("Équipé");
    expect(buyLabel(false, true)).toBe("Équiper");
    expect(buyLabel(false, false)).toBe("Acheter");
    expect(bundleHint(true, 190)).toBe("Les trois éléments sont dans ton inventaire.");
    expect(bundleHint(false, 190)).toContain("190 au lieu de 240");
    expect(bundleHint(false, 120)).toContain("Prix réduit");
  });

  it("labels profile rewards", () => {
    expect(rewardLabel(true, true, "Équipée", "Gagne 10 parties")).toBe("Équipée");
    expect(rewardLabel(false, true, "Équipée", "Gagne 10 parties")).toBe("Équiper");
    expect(rewardLabel(false, false, "Équipé", "Gagne 10 parties")).toBe("Gagne 10 parties");
  });

  it("explains why a private race cannot start yet", () => {
    expect(startLabel(1, true)).toBe("En attente d’un adversaire");
    expect(startLabel(2, true)).toBe("Lancer la course");
    expect(startLabel(3, false)).toBe("Tous les joueurs doivent être prêts");
  });

  it("explains an empty achievement list", () => {
    expect(emptyMessage("todo", "all")).toBe("Tous les défis de cette catégorie sont terminés !");
    expect(emptyMessage("done", "epic")).toBe("Aucun cadre épique découvert pour le moment.");
    expect(emptyMessage("frames", "legendary")).toBe(
      "Aucun cadre légendaire découvert pour le moment.",
    );
    expect(emptyMessage("done", "all")).toBe("Termine un défi pour gagner ton premier cadre.");
  });
});
