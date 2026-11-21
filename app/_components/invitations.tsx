"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gift, Share2, X } from "lucide-react";
import { useI18n } from "@/app/lib/i18n";
import { authHeaders } from "@/app/lib/auth-headers";
import {
  colorTier,
  invitationTiers,
  type InvitationColor,
  type InvitationState,
} from "@/lib/invitations";
import { pseudonymClass } from "@/app/lib/pseudonym";
import "./invitations.css";

const labels: Record<InvitationColor, [string, string]> = {
  electric: ["Bleu électrique", "Electric blue"],
  mint: ["Menthe", "Mint"],
  coral: ["Corail", "Coral"],
  turquoise: ["Turquoise", "Turquoise"],
  amethyst: ["Améthyste", "Amethyst"],
  fuchsia: ["Fuchsia", "Fuchsia"],
  ice: ["Bleu glacier", "Ice blue"],
  emerald: ["Émeraude", "Emerald"],
  copper: ["Cuivre", "Copper"],
  aurora: ["Bleu → violet", "Blue → violet"],
  sunset: ["Corail → rose", "Coral → pink"],
  lagoon: ["Turquoise → menthe", "Turquoise → mint"],
  gold: ["Or classique", "Classic gold"],
  "rose-gold": ["Or rose", "Rose gold"],
  "solar-gold": ["Or solaire", "Solar gold"],
};

export type InvitationSession = ReturnType<typeof useInvitations>;
async function invitationRequest(color?: string | null, signal?: AbortSignal) {
  const headers = await authHeaders();
  const response = await fetch("/api/invitations", {
    headers: color === undefined ? headers : { ...headers, "Content-Type": "application/json" },
    method: color === undefined ? "GET" : "POST",
    body: color === undefined ? undefined : JSON.stringify({ color }),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw Error("invitation_unavailable");
  return response.json() as Promise<InvitationState>;
}

export function useInvitations(userId: string | undefined, enabled: boolean) {
  const [loaded, setLoaded] = useState<{ userId: string; data: InvitationState } | null>(null);
  const [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  const current = useRef(userId);
  useEffect(() => {
    current.current = userId;
  }, [userId]);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId || !enabled) return;
      const version = ++sequence.current;
      try {
        const data = await invitationRequest(undefined, signal);
        if (!signal?.aborted && current.current === userId && sequence.current === version) {
          setLoaded({ userId, data });
          setFailed(false);
        }
      } catch {
        if (!signal?.aborted && current.current === userId && sequence.current === version)
          setFailed(true);
      }
    },
    [userId, enabled],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const focus = () => void refresh(controller.signal);
    window.addEventListener("focus", focus);
    const timer = window.setInterval(() => {
      if (!document.hidden) focus();
    }, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  async function choose(color: string | null) {
    if (!userId || !enabled) return;
    const data = await invitationRequest(color);
    if (current.current === userId) {
      sequence.current++;
      setLoaded({ userId, data });
      setFailed(false);
    }
  }
  return {
    data: loaded?.userId === userId ? (loaded?.data ?? null) : null,
    failed,
    refresh,
    choose,
  };
}

export function InviteTeaser({ session, open }: { session: InvitationSession; open: () => void }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const count = session.data?.count ?? 0;
  const reward = invitationTiers.find(
    (tier) => tier.count <= count && !session.data?.rewards.some((r) => r.tier === tier.count),
  );
  const next = invitationTiers.find((tier) => tier.count > count);
  return (
    <div className="invite-teaser">
      <button className="install-cta invite-cta" type="button" onClick={open}>
        <Share2 aria-hidden="true" /> {fr ? "Inviter un ami" : "Invite a friend"}
      </button>
      <p className="invite-teaser-copy">
        <Gift aria-hidden="true" />
        {reward
          ? fr
            ? `Palier ${reward.count} atteint : choisis ta couleur !`
            : `Tier ${reward.count} reached: pick your color!`
          : !session.data
            ? fr
              ? "Pseudo coloré dès 5 amis actifs · Or à 25"
              : "Color your username at 5 active friends · Gold at 25"
            : next
              ? fr
                ? `${count}/${next.count} amis actifs · ${next.count === 25 ? "Or au prochain palier" : "Prochain choix de couleur"}`
                : `${count}/${next.count} active friends · ${next.count === 25 ? "Gold is next" : "Next color reward"}`
              : fr
                ? "Tous les paliers débloqués"
                : "All tiers unlocked"}
      </p>
    </div>
  );
}

export function InvitationDialog({
  session,
  username,
  close,
  signIn,
  onEquip,
}: {
  session: InvitationSession;
  username?: string | null;
  close: () => void;
  signIn: () => void;
  onEquip: () => Promise<unknown>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<InvitationColor | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const { locale } = useI18n();
  const fr = locale === "fr";
  const { data } = session;
  const demoName = username ?? (fr ? "TonPseudo" : "YourUsername");
  const selectedTier = colorTier(preview);
  const selectedReward = data?.rewards.find((reward) => reward.tier === selectedTier?.count);
  const unlocked = Boolean(
    data &&
    selectedTier &&
    (selectedReward?.color === preview || (!selectedReward && data.count >= selectedTier.count)),
  );
  const link =
    data && typeof window !== "undefined"
      ? new URL(`/?invitation=${data.code}`, window.location.origin).href
      : "";
  useEffect(() => {
    ref.current?.showModal();
    void session.refresh();
  }, [session.refresh]);

  async function share() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Sudoklash",
          text: fr
            ? "Tu crois être plus rapide que moi au sudoku ? Viens me défier sur Sudoklash."
            : "Think you’re faster at Sudoku? Come challenge me on Sudoklash.",
          url: link,
        });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setNotice(fr ? "Lien copié." : "Link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice(
        fr ? "Sélectionne et copie ton lien ci-dessous." : "Select and copy your link below.",
      );
    }
  }
  async function equip(color: string | null) {
    setBusy(true);
    try {
      await session.choose(color);
      await onEquip();
      setNotice(fr ? "Couleur de pseudo enregistrée." : "Username color saved.");
    } catch {
      setNotice(
        fr
          ? "Impossible de choisir cette couleur. Réessaie."
          : "Could not choose this color. Try again.",
      );
      void session.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="install-guide invitation-dialog"
      aria-labelledby="invitation-title"
      onClose={close}
    >
      <button
        type="button"
        className="install-guide-close"
        aria-label={fr ? "Fermer" : "Close"}
        onClick={() => ref.current?.close()}
      >
        <X aria-hidden="true" />
      </button>
      <h2 id="invitation-title">
        {fr ? "Invite des amis, colore ton pseudo" : "Invite friends, color your username"}
      </h2>
      <p>
        {fr
          ? "Une invitation compte quand un ami crée son compte avec ton lien et termine sa première grille en ligne. À chaque palier, choisis une couleur exclusive."
          : "An invitation counts when a friend signs up with your link and completes their first online puzzle. At each tier, choose an exclusive color."}
      </p>
      {data ? (
        <>
          <button className="primary invite-share" type="button" onClick={() => void share()}>
            <Share2 aria-hidden="true" /> {fr ? "Partager mon invitation" : "Share my invitation"}
          </button>
          <input
            ref={input}
            className="invite-url"
            value={link}
            readOnly
            aria-label={fr ? "Ton lien d’invitation" : "Your invitation link"}
            onFocus={(event) => event.target.select()}
          />
          <p>
            <strong>{data.count}</strong> {fr ? "ami(s) actif(s)" : "active friend(s)"}
          </p>
        </>
      ) : username ? (
        <p>
          {session.failed ? (
            <button className="tournament-link" onClick={() => void session.refresh()}>
              {fr ? "Réessayer" : "Try again"}
            </button>
          ) : fr ? (
            "Chargement de ton lien…"
          ) : (
            "Loading your link…"
          )}
        </p>
      ) : (
        <button className="primary" type="button" onClick={signIn}>
          {fr ? "Se connecter pour obtenir mon lien" : "Sign in to get my link"}
        </button>
      )}
      <div className="invite-preview">
        {fr ? "Aperçu :" : "Preview:"}{" "}
        <strong className={pseudonymClass(preview ?? data?.selected)}>{demoName}</strong>
      </div>
      <div className="invite-tiers">
        {invitationTiers.map((tier) => {
          const earned = data?.rewards.find((r) => r.tier === tier.count);
          const available = (data?.count ?? 0) >= tier.count;
          return (
            <section key={tier.count}>
              <h3>
                {tier.count} {fr ? "amis actifs" : "active friends"}{" "}
                <small>
                  {earned
                    ? fr
                      ? "Choix enregistré"
                      : "Choice saved"
                    : available
                      ? fr
                        ? "Récompense à choisir"
                        : "Reward to choose"
                      : fr
                        ? "À débloquer"
                        : "Locked"}
                </small>
              </h3>
              <div className="invite-swatches">
                {tier.colors.map((color) => (
                  <button
                    className="tournament-link"
                    key={color}
                    type="button"
                    aria-pressed={preview === color}
                    onClick={() => setPreview(color)}
                  >
                    <strong className={pseudonymClass(color)}>{labels[color][fr ? 0 : 1]}</strong>
                    {earned?.color === color ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <div className="invite-actions">
        {preview && unlocked && data?.selected !== preview && (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void equip(preview)}
          >
            {selectedReward
              ? fr
                ? "Utiliser cette couleur"
                : "Use this color"
              : fr
                ? "Choisir cette couleur"
                : "Choose this color"}
          </button>
        )}
        {preview && data && !unlocked && (
          <small>
            {selectedReward
              ? fr
                ? "Une autre couleur a déjà été choisie à ce palier."
                : "You already chose another color at this tier."
              : fr
                ? "Atteins ce palier pour choisir ta couleur."
                : "Reach this tier to choose your color."}
          </small>
        )}
        {data?.selected && (
          <button
            type="button"
            className="tournament-link"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              void equip(null);
            }}
          >
            {fr ? "Couleur par défaut" : "Default color"}
          </button>
        )}
      </div>
      <p role="status">{notice}</p>
    </dialog>
  );
}
