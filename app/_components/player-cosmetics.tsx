"use client";
import { useState } from "react";
import { Coins, ImagePlus, Trash2 } from "lucide-react";
import type { AccountState } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { challengeFrameStyle, elementLabels } from "@/lib/achievement-styles";
import { ElementalFrame } from "./elemental-frame";
import "../divine-frame.css";
import {
  achievementAvatars,
  avatars,
  levelFrames,
  rankedFrames,
  shopAvatars,
} from "@/lib/cosmetics";

export function PlayerAvatar({
  avatarId = "nova",
  frameId = "starter",
  size = "normal",
  fallback,
  image,
}: {
  avatarId?: string;
  frameId?: string;
  size?: "normal" | "large" | "small";
  fallback?: string;
  image?: string | null;
}) {
  const custom = avatarId === "custom" && !!image && fallback === undefined;
  const avatar = avatars.find((a) => a.id === avatarId) ?? avatars[0],
    frame = levelFrames.find((f) => f.id === frameId) ?? levelFrames[0],
    rankFrame = rankedFrames.find((f) => `rank-${f.id}` === frameId),
    achievement = challengeFrameStyle(frameId);
  return (
    <span
      className={`player-avatar ${size}${rankFrame ? " ranked-avatar" : ""}${achievement ? " achievement-frame" : ""}${achievement?.rarity === "epic" ? " epic-frame" : ""}${achievement?.rarity === "legendary" ? " legendary-frame" : ""}${achievement?.rarity === "majestic" ? " majestic-frame" : ""}${frameId === "none" ? " frameless-avatar" : ""}`}
      data-rank={rankFrame?.id}
      data-divine={frameId === "challenge-l-026" ? "true" : undefined}
      data-frame-pattern={achievement?.pattern}
      style={
        {
          "--avatar-one": avatar.colors[0],
          "--avatar-two": avatar.colors[1],
          "--frame-color": rankFrame?.color ?? achievement?.color ?? frame.color,
          "--frame-accent": rankFrame?.accent ?? achievement?.accent ?? frame.color,
          "--frame-highlight": achievement?.highlight ?? "#ffffff",
          "--rank-symbol": `"${rankFrame?.symbol ?? achievement?.symbol ?? ""}"`,
        } as React.CSSProperties
      }
      role="img"
      aria-label={`Avatar ${custom ? "personnalisé" : avatar.name}, ${frameId === "none" ? "sans cadre" : rankFrame ? `cadre ${rankFrame.name}` : achievement?.element ? `cadre ${elementLabels[achievement.element]}` : achievement ? "cadre de défi" : `cadre ${frame.name}`}`}
    >
      {custom ? (
        <span className="avatar-image">
          <img src={image!} alt="" />
        </span>
      ) : (
        <span>{fallback ?? avatar.symbol}</span>
      )}
      {achievement && <ElementalFrame element={achievement.element} variant={achievement.variant} motif={achievement.motif} legendary={achievement.rarity === "legendary" || achievement.rarity === "majestic"} />}
      {frameId === "challenge-l-026" && (
        <svg className="divine-halo" viewBox="0 0 100 60" aria-hidden="true">
          <ellipse className="divine-halo-glow" cx="50" cy="35" rx="33" ry="11" />
          <ellipse className="divine-halo-ring" cx="50" cy="35" rx="30" ry="8" />
          <ellipse className="divine-halo-inner" cx="50" cy="35" rx="24" ry="5" />
          <path className="divine-halo-rays" d="M50 5v9 M27 10l4 8 M73 10l-4 8 M12 22l8 4 M88 22l-8 4 M45 16l5-6 5 6-5 6Z" />
        </svg>
      )}
    </span>
  );
}

// Center-crops the picture to a small square so it stays light enough to store with the account.
async function avatarDataUrl(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight),
      size = 256,
      canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx || !side) throw Error("invalid_image");
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    const webp = canvas.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function CustomAvatarUpload({
  cosmetics,
  notify,
  busy,
  setBusy,
}: {
  cosmetics: Cosmetics;
  notify: (message: string) => void;
  busy: string;
  setBusy: (id: string) => void;
}) {
  const data = cosmetics.state!,
    selected = data.avatarId === "custom";
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Choisis un fichier image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify("Image trop lourde (10 Mo maximum).");
      return;
    }
    setBusy("custom");
    try {
      await cosmetics.action("upload_avatar", await avatarDataUrl(file));
      notify("Photo de profil enregistrée");
    } catch {
      notify("Impossible d’importer cette image.");
    } finally {
      setBusy("");
    }
  };
  const run = async (action: "equip_avatar" | "remove_avatar", message: string) => {
    setBusy("custom");
    try {
      await cosmetics.action(action, "custom");
      notify(message);
    } catch {
      notify("Impossible d’enregistrer. Réessayez.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="custom-avatar-upload">
      <label className={busy ? "disabled" : ""}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={!!busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {data.customAvatar ? (
          <PlayerAvatar
            avatarId="custom"
            image={data.customAvatar}
            frameId={selected ? data.frameId : "starter"}
          />
        ) : (
          <span className="upload-icon">
            <ImagePlus />
          </span>
        )}
        <span>
          <b>
            {busy === "custom"
              ? "Envoi en cours…"
              : data.customAvatar
                ? "Changer mon image"
                : "Importer une image"}
          </b>
          <small>PNG, JPEG, WebP ou GIF · recadrée en carré</small>
        </span>
      </label>
      {data.customAvatar && (
        <div className="custom-avatar-actions">
          <button
            className={selected ? "selected" : ""}
            aria-pressed={selected}
            disabled={selected || !!busy}
            onClick={() => void run("equip_avatar", "Photo de profil équipée")}
          >
            {selected ? "Équipée" : "Utiliser mon image"}
          </button>
          <button
            disabled={!!busy}
            onClick={() => void run("remove_avatar", "Image supprimée")}
            aria-label="Supprimer mon image"
          >
            <Trash2 />
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

export function CosmeticCloset({
  cosmetics,
  notify,
}: {
  cosmetics: Cosmetics;
  notify: (message: string) => void;
}) {
  const data = cosmetics.state,
    [busy, setBusy] = useState("");
  if (cosmetics.loading && !data)
    return <section className="panel cosmetic-closet">Chargement de la progression…</section>;
  if (!data)
    return (
      <section className="panel cosmetic-closet">
        <p>Personnalisation momentanément indisponible.</p>
        <button onClick={() => void cosmetics.refresh()}>Réessayer</button>
      </section>
    );
  const choose = async (action: "equip_avatar" | "equip_frame", id: string) => {
    setBusy(id);
    try {
      await cosmetics.action(action, id);
      notify("Apparence mise à jour");
    } catch {
      notify("Impossible d’enregistrer. Réessayez.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="panel cosmetic-closet">
      <div className="closet-heading">
        <div>
          <span className="eyebrow">PROGRESSION DU COMPTE</span>
          <h3>Niveau {data.level}</h3>
          <p>{data.xp} XP au total · Rang classé indépendant</p>
        </div>
        <PlayerAvatar
          avatarId={data.avatarId}
          image={data.customAvatar}
          frameId={data.frameId}
          size="large"
        />
      </div>
      <div
        className="level-track"
        role="progressbar"
        aria-label="Progression vers le prochain niveau"
        aria-valuenow={data.levelXp}
        aria-valuemin={0}
        aria-valuemax={data.nextLevelXp}
      >
        <span style={{ width: `${Math.min(100, (data.levelXp / data.nextLevelXp) * 100)}%` }} />
      </div>
      <small>
        {data.nextLevelXp - data.levelXp} XP avant le niveau {data.level + 1}
      </small>
      <h4>Choisir mon avatar</h4>
      <p>
        Importe ta propre image ou choisis parmi 15 avatars gratuits. Les autres se débloquent dans
        la boutique ou avec des succès.
      </p>
      <CustomAvatarUpload cosmetics={cosmetics} notify={notify} busy={busy} setBusy={setBusy} />
      <div className="cosmetic-grid">
        {avatars.map((a) => {
          const owned = data.ownedAvatars.includes(a.id),
            selected = data.avatarId === a.id,
            achievement = achievementAvatars.find((x) => x.id === a.id),
            product = shopAvatars.find((x) => x.id === a.id);
          return (
            <button
              key={a.id}
              className={selected ? "selected" : ""}
              disabled={!owned || !!busy}
              onClick={() => void choose("equip_avatar", a.id)}
              aria-pressed={selected}
              title={!owned ? (achievement?.requirement ?? `${product?.price} Sudokoins`) : a.name}
            >
              <PlayerAvatar avatarId={a.id} frameId={selected ? data.frameId : "starter"} />
              <b>{a.name}</b>
              <small>
                {selected
                  ? "Équipé"
                  : owned
                    ? "Choisir"
                    : achievement
                      ? achievement.requirement
                      : `${product?.price} Sudokoins`}
              </small>
            </button>
          );
        })}
      </div>
      <h4>Cadres de rang classé</h4>
      <p>
        Ton cadre suit automatiquement ton rang. Tu peux aussi le masquer ou choisir un cadre de
        niveau. Les animations se désactivent selon les préférences de mouvement de ton appareil.
      </p>
      <div className="rank-frame-actions">
        <button
          className={data.frameSelection === "rank_auto" ? "selected" : ""}
          aria-pressed={data.frameSelection === "rank_auto"}
          disabled={!!busy}
          onClick={() => void choose("equip_frame", "rank_auto")}
        >
          <PlayerAvatar
            avatarId={data.avatarId}
            image={data.customAvatar}
            frameId={`rank-${data.rankName}`}
          />
          <span>
            <b>Afficher mon rang</b>
            <small>
              {data.rank} · {data.rankPoints} points · évolue automatiquement
            </small>
          </span>
        </button>
        <button
          className={data.frameSelection === "none" ? "selected" : ""}
          aria-pressed={data.frameSelection === "none"}
          disabled={!!busy}
          onClick={() => void choose("equip_frame", "none")}
        >
          <PlayerAvatar avatarId={data.avatarId} image={data.customAvatar} frameId="none" />
          <span>
            <b>Masquer le cadre</b>
            <small>Garder uniquement l'avatar</small>
          </span>
        </button>
      </div>
      <div className="rank-frame-showcase" aria-label="Aperçu des cadres de rang">
        {rankedFrames.map((f) => (
          <div key={f.id} className={f.id === data.rankName ? "current" : ""}>
            <PlayerAvatar
              avatarId={data.avatarId}
              image={data.customAvatar}
              frameId={`rank-${f.id}`}
            />
            <b>{f.id}</b>
            {f.id === data.rankName && <small>Ton rang</small>}
          </div>
        ))}
      </div>
      <h4>Mes cadres de niveau</h4>
      <div className="frame-grid">
        {levelFrames.map((f) => (
          <button
            key={f.id}
            disabled={!data.unlockedFrames.includes(f.id) || !!busy}
            className={data.frameSelection === f.id ? "selected" : ""}
            aria-pressed={data.frameSelection === f.id}
            onClick={() => void choose("equip_frame", f.id)}
          >
            <PlayerAvatar avatarId={data.avatarId} image={data.customAvatar} frameId={f.id} />
            <span>
              <b>{f.name}</b>
              <small>
                {data.unlockedFrames.includes(f.id)
                  ? data.frameSelection === f.id
                    ? "Équipé"
                    : "Choisir"
                  : `Niveau ${f.level}`}
              </small>
            </span>
          </button>
        ))}
      </div>
      <h4>Cadres gagnés avec les défis</h4>
      <p>Retrouve la progression des défis dans la rubrique Défis.</p>
      <div className="frame-grid">
        {data.achievementFrames.map((f) => (
          <button
            key={f.id}
            disabled={!!busy}
            className={data.frameSelection === f.id ? "selected" : ""}
            aria-pressed={data.frameSelection === f.id}
            onClick={() => void choose("equip_frame", f.id)}
          >
            <PlayerAvatar avatarId={data.avatarId} image={data.customAvatar} frameId={f.id} />
            <span>
              <b>{f.name}</b>
              <small>
                {data.frameSelection === f.id
                  ? "Équipé"
                  : f.rarity === "simple"
                    ? "Thématique"
                    : f.rarity === "epic"
                      ? "Épique"
                      : f.rarity === "majestic"
                        ? "Majestueux"
                        : "Légendaire"}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AvatarShop({
  cosmetics,
  notify,
  openAuth,
  account,
}: {
  cosmetics: Cosmetics;
  notify: (message: string) => void;
  openAuth: () => void;
  account: AccountState;
}) {
  const [busy, setBusy] = useState("");
  if (!account.user)
    return (
      <section className="panel cosmetic-closet">
        <h3>Avatars Sudoku Clash</h3>
        <p>Connecte-toi pour enregistrer tes avatars et tes Sudokoins.</p>
        <button className="primary" onClick={openAuth}>
          Se connecter
        </button>
      </section>
    );
  if (!cosmetics.state)
    return <section className="panel cosmetic-closet">Chargement de la boutique…</section>;
  const data = cosmetics.state;
  const buy = async (id: string) => {
    setBusy(id);
    try {
      await cosmetics.action(data.ownedAvatars.includes(id) ? "equip_avatar" : "buy_avatar", id);
      notify(data.ownedAvatars.includes(id) ? "Avatar équipé" : "Avatar débloqué !");
    } catch (e) {
      notify(
        e instanceof Error && e.message === "not_enough_coins"
          ? "Pas assez de Sudokoins"
          : "Achat indisponible. Réessaie.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="panel cosmetic-closet avatar-shop">
      <div className="closet-heading">
        <div>
          <span className="eyebrow">AVATARS COSMÉTIQUES</span>
          <h3>Choisis ton style</h3>
          <p>Gagne des Sudokoins en terminant des grilles et en remportant des duels.</p>
        </div>
        <strong>
          <Coins />
          {data.coins} Sudokoins
        </strong>
      </div>
      <div className="cosmetic-grid">
        {shopAvatars.map((a) => (
          <button
            key={a.id}
            disabled={!!busy || (!data.ownedAvatars.includes(a.id) && data.coins < a.price)}
            onClick={() => void buy(a.id)}
          >
            <PlayerAvatar avatarId={a.id} />
            <b>{a.name}</b>
            <small>
              {data.avatarId === a.id
                ? "Équipé"
                : data.ownedAvatars.includes(a.id)
                  ? "Équiper"
                  : `${a.price} Sudokoins`}
            </small>
          </button>
        ))}
      </div>
      <h4>À gagner avec les succès</h4>
      <div className="cosmetic-grid">
        {achievementAvatars.map((a) => (
          <div className="achievement-avatar" key={a.id}>
            <PlayerAvatar avatarId={a.id} />
            <b>{a.name}</b>
            <small>{data.ownedAvatars.includes(a.id) ? "Débloqué" : a.requirement}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
