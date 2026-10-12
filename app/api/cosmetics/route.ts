import { premiumOwned, parseCollectionItem, bundlePrice } from "@/lib/premium-collections";
import { premiumPrice } from "@/lib/premium";
import { env } from "cloudflare:workers";
import { getSiteUser } from "@/app/supabase-auth";
import {
  achievementAvatars,
  avatars,
  freeAvatars,
  gridThemes,
  levelFrames,
  progressFor,
  shopAvatars,
  shopFrames,
  soloXpFor,
  type ProgressCounts,
} from "@/lib/cosmetics";
import { rankedPosition } from "@/lib/ranked-position";
import { rankFor } from "@/lib/ranked-rules";
import { achievementFrames } from "@/lib/achievement-frames";
import { playerAchievements } from "@/lib/achievement-awards";
import { profileCards, profileTitles, unlockedRewards } from "@/lib/profile-rewards";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
// Uploaded avatars are resized in the browser; this caps what a crafted request can store.
const MAX_AVATAR_IMAGE_LENGTH = 200_000;
const AVATAR_IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

async function counts(userId: string): Promise<ProgressCounts> {
  const db = env.DB!;
  const [solo, daily, weekly, rating] = await Promise.all([
    db
      .prepare(
        "SELECT difficulty, COUNT(*) AS n FROM solo_results WHERE user_id=? GROUP BY difficulty",
      )
      .bind(userId)
      .all<{ difficulty: string; n: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM daily_attempts WHERE user_id=? AND completed_at IS NOT NULL",
      )
      .bind(userId)
      .first<{ n: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM weekly_attempts WHERE user_id=? AND completed_at IS NOT NULL",
      )
      .bind(userId)
      .first<{ n: number }>(),
    db
      .prepare("SELECT wins,losses FROM ranked_ratings WHERE user_id=?")
      .bind(userId)
      .first<{ wins: number; losses: number }>(),
  ]);
  return {
    solo: solo.results.reduce((total, row) => total + row.n, 0),
    soloXp: solo.results.reduce((total, row) => total + row.n * soloXpFor(row.difficulty), 0),
    daily: daily?.n ?? 0,
    weekly: weekly?.n ?? 0,
    wins: rating?.wins ?? 0,
    losses: rating?.losses ?? 0,
  };
}

async function state(userId: string) {
  const db = env.DB!;
  const [score, selection, purchases, rating, image, premium] = await Promise.all([
    counts(userId),
    db
      .prepare(
        "SELECT avatar_id,frame_id,theme_id,profile_card_id,profile_title_id,victory_effect_id FROM player_cosmetics WHERE user_id=?",
      )
      .bind(userId)
      .first<{
        avatar_id: string;
        frame_id: string;
        theme_id: string;
        profile_card_id: string;
        profile_title_id: string;
        victory_effect_id: string;
      }>(),
    db
      .prepare("SELECT item_id,price,premium_price FROM cosmetic_purchases WHERE user_id=?")
      .bind(userId)
      .all<{ item_id: string; price: number; premium_price: number }>(),
    db
      .prepare("SELECT points FROM ranked_ratings WHERE user_id=?")
      .bind(userId)
      .first<{ points: number }>(),
    db
      .prepare("SELECT image_data FROM player_avatar_images WHERE user_id=?")
      .bind(userId)
      .first<{ image_data: string }>(),
    db
      .prepare("SELECT COALESCE(SUM(gems),0) AS gems FROM premium_credits WHERE user_id=?")
      .bind(userId)
      .first<{ gems: number }>(),
  ]);
  const progress = progressFor(score);
  const owned = [
    ...freeAvatars.map((a) => a.id),
    ...purchases.results
      .filter((p) => p.item_id.startsWith("avatar:"))
      .map((a) => a.item_id.slice(7)),
    ...achievementAvatars.filter((a) => a.unlocked(score)).map((a) => a.id),
    ...(image ? ["custom"] : []),
  ];
  const ownedThemes = [
    "ocean",
    ...purchases.results
      .filter((p) => p.item_id.startsWith("theme:"))
      .map((p) => p.item_id.slice(6)),
  ];
  const collectionOwned = [...premiumOwned(purchases.results.map((p) => p.item_id))];
  const ownedEffects = ["none", ...collectionOwned.filter((id) => id.endsWith("-effect"))];
  const purchasedFrames = purchases.results
    .filter((p) => p.item_id.startsWith("frame:"))
    .map((p) => p.item_id.slice(6))
    .concat(collectionOwned.filter((id) => id.endsWith("-frame")));
  const unlockedFrames = levelFrames.filter((f) => f.level <= progress.level);
  const points = rating?.points ?? 0;
  const position = await rankedPosition(db, userId, points);
  const rank = rankFor(points, position);
  const awards = await playerAchievements(db, userId, points);
  const achievementIds = [...awards.ids];
  const rewardProgress = { ...awards.progress, epicFrames: awards.epicCount };
  const ownedCards = unlockedRewards(profileCards, rewardProgress)
    .map((reward) => reward.id)
    .concat(collectionOwned.filter((id) => id.endsWith("-card")));
  const ownedTitles = unlockedRewards(profileTitles, rewardProgress).map((reward) => reward.id);
  const savedFrame = selection?.frame_id;
  const frameSelection =
    savedFrame === "rank_auto" ||
    savedFrame === "none" ||
    unlockedFrames.some((f) => f.id === savedFrame) ||
    achievementIds.includes(savedFrame ?? "") ||
    purchasedFrames.includes(savedFrame ?? "")
      ? savedFrame
      : "rank_auto";
  const frameId = frameSelection === "rank_auto" ? `rank-${rank.name}` : frameSelection;
  return {
    ...progress,
    counts: score,
    coins: Math.max(
      0,
      progress.earnedCoins - purchases.results.reduce((sum, p) => sum + p.price, 0),
    ),
    gems: Math.max(
      0,
      (premium?.gems ?? 0) - purchases.results.reduce((sum, p) => sum + p.premium_price, 0),
    ),
    ownedAvatars: owned,
    ownedThemes,
    unlockedFrames: [...unlockedFrames.map((f) => f.id), ...achievementIds, ...purchasedFrames],
    achievementFrames: achievementFrames
      .filter((f) => achievementIds.includes(f.id))
      .map(({ id, name, rarity }) => ({ id, name, rarity })),
    avatarId: owned.includes(selection?.avatar_id ?? "") ? selection!.avatar_id : "nova",
    frameId,
    frameSelection,
    rank: rank.label,
    rankName: rank.name,
    rankPoints: points,
    customAvatar: image?.image_data ?? null,
    themeId: ownedThemes.includes(selection?.theme_id ?? "") ? selection!.theme_id : "ocean",
    premiumSpent: purchases.results.reduce((sum, p) => sum + p.premium_price, 0),
    ownedEffects,
    victoryEffectId: ownedEffects.includes(selection?.victory_effect_id ?? "")
      ? selection!.victory_effect_id
      : "none",
    ownedCards,
    ownedTitles,
    profileCardId: ownedCards.includes(selection?.profile_card_id ?? "")
      ? selection!.profile_card_id
      : "origin",
    profileTitleId: ownedTitles.includes(selection?.profile_title_id ?? "")
      ? selection!.profile_title_id
      : "none",
  };
}

export async function GET(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!env.DB) return json({ error: "cosmetics_unavailable" }, 503);
  try {
    return json(await state(user.userId));
  } catch {
    return json({ error: "cosmetics_unavailable" }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getSiteUser(request);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (!env.DB) return json({ error: "cosmetics_unavailable" }, 503);
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    id?: unknown;
    currency?: unknown;
  } | null;
  if (typeof body?.id !== "string" || typeof body.action !== "string")
    return json({ error: "invalid_request" }, 400);
  const db = env.DB!;
  try {
    const current = await state(user.userId);
    if (body.action === "equip_avatar") {
      if (
        !(avatars.some((a) => a.id === body.id) || body.id === "custom") ||
        !current.ownedAvatars.includes(body.id)
      )
        return json({ error: "avatar_locked" }, 403);
      await db
        .prepare(
          "INSERT INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar_id=excluded.avatar_id",
        )
        .bind(user.userId, body.id, current.frameSelection, current.themeId)
        .run();
    } else if (body.action === "upload_avatar") {
      if (body.id.length > MAX_AVATAR_IMAGE_LENGTH || !AVATAR_IMAGE_PATTERN.test(body.id))
        return json({ error: "invalid_image" }, 400);
      await db.batch([
        db
          .prepare(
            "INSERT INTO player_avatar_images (user_id,image_data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET image_data=excluded.image_data,updated_at=excluded.updated_at",
          )
          .bind(user.userId, body.id, Date.now()),
        db
          .prepare(
            "INSERT INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar_id=excluded.avatar_id",
          )
          .bind(user.userId, "custom", current.frameSelection, current.themeId),
      ]);
    } else if (body.action === "remove_avatar") {
      await db.batch([
        db.prepare("DELETE FROM player_avatar_images WHERE user_id=?").bind(user.userId),
        db
          .prepare(
            "UPDATE player_cosmetics SET avatar_id='nova' WHERE user_id=? AND avatar_id='custom'",
          )
          .bind(user.userId),
      ]);
    } else if (body.action === "buy_premium") {
      const product = parseCollectionItem(body.id);
      if (!product || body.currency !== "gems") return json({ error: "invalid_item" }, 400);
      const owned = [...current.unlockedFrames, ...current.ownedCards, ...current.ownedEffects];
      if (owned.includes(body.id)) return json(current);
      const cost =
        product.kind === "bundle" ? bundlePrice(product.collection.id, owned) : product.price;
      if (cost === 0) return json(current);
      const itemId = `premium:${body.id}`;
      // Ownership and both balances are checked again in the same guarded database write.
      const result = await db
        .prepare(
          `INSERT INTO cosmetic_purchases (user_id,item_id,price,premium_price,purchased_at)
        SELECT ?,?,0,?,? WHERE COALESCE((SELECT SUM(gems) FROM premium_credits WHERE user_id=?),0)-COALESCE((SELECT SUM(premium_price) FROM cosmetic_purchases WHERE user_id=?),0)>=?
        AND NOT EXISTS(SELECT 1 FROM cosmetic_purchases WHERE user_id=? AND item_id=?)
        AND ? = COALESCE((SELECT SUM(premium_price) FROM cosmetic_purchases WHERE user_id=?),0)`,
        )
        .bind(
          user.userId,
          itemId,
          cost,
          Date.now(),
          user.userId,
          user.userId,
          cost,
          user.userId,
          itemId,
          current.premiumSpent,
          user.userId,
        )
        .run();
      if (!result.meta.changes) return json({ error: "not_enough_gems" }, 409);
    } else if (body.action === "equip_effect") {
      if (!current.ownedEffects.includes(body.id)) return json({ error: "effect_locked" }, 403);
      await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?)",
          )
          .bind(user.userId, current.avatarId, current.frameSelection, current.themeId),
        db
          .prepare("UPDATE player_cosmetics SET victory_effect_id=? WHERE user_id=?")
          .bind(body.id, user.userId),
      ]);
    } else if (body.action === "equip_frame") {
      if (
        body.id !== "rank_auto" &&
        body.id !== "none" &&
        !current.unlockedFrames.some((id) => id === body.id)
      )
        return json({ error: "frame_locked" }, 403);
      await db
        .prepare(
          "INSERT INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET frame_id=excluded.frame_id",
        )
        .bind(user.userId, current.avatarId, body.id, current.themeId)
        .run();
    } else if (body.action === "equip_theme") {
      if (!current.ownedThemes.includes(body.id)) return json({ error: "theme_locked" }, 403);
      await db
        .prepare(
          "INSERT INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET theme_id=excluded.theme_id",
        )
        .bind(user.userId, current.avatarId, current.frameSelection, body.id)
        .run();
    } else if (body.action === "equip_profile_card" || body.action === "equip_profile_title") {
      const card = body.action === "equip_profile_card";
      if (!(card ? current.ownedCards : current.ownedTitles).includes(body.id))
        return json({ error: "reward_locked" }, 403);
      await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?)",
          )
          .bind(user.userId, current.avatarId, current.frameSelection, current.themeId),
        db
          .prepare(
            card
              ? "UPDATE player_cosmetics SET profile_card_id=? WHERE user_id=?"
              : "UPDATE player_cosmetics SET profile_title_id=? WHERE user_id=?",
          )
          .bind(body.id, user.userId),
      ]);
    } else if (
      body.action === "buy_avatar" ||
      body.action === "buy_theme" ||
      body.action === "buy_frame"
    ) {
      const avatar = body.action === "buy_avatar";
      const frame = body.action === "buy_frame";
      const product = frame
        ? shopFrames.find((f) => f.id === body.id)
        : avatar
          ? shopAvatars.find((a) => a.id === body.id)
          : gridThemes.find((a) => a.id === body.id);
      if (!product) return json({ error: "invalid_item" }, 400);
      if (
        frame
          ? current.unlockedFrames.includes(product.id)
          : avatar
            ? current.ownedAvatars.includes(product.id)
            : current.ownedThemes.includes(product.id)
      )
        return json(current);
      const itemId = `${frame ? "frame" : avatar ? "avatar" : "theme"}:${product.id}`;
      if (body.currency !== undefined && body.currency !== "coins" && body.currency !== "gems")
        return json({ error: "invalid_currency" }, 400);
      if (body.currency === "gems") {
        const cost = premiumPrice(product.price);
        const result = await db
          .prepare(
            `INSERT INTO cosmetic_purchases (user_id,item_id,price,premium_price,purchased_at)
          SELECT ?,?,0,?,? WHERE COALESCE((SELECT SUM(gems) FROM premium_credits WHERE user_id=?),0) - COALESCE((SELECT SUM(premium_price) FROM cosmetic_purchases WHERE user_id=?),0) >= ?
          AND NOT EXISTS (SELECT 1 FROM cosmetic_purchases WHERE user_id=? AND item_id=?)`,
          )
          .bind(
            user.userId,
            itemId,
            cost,
            Date.now(),
            user.userId,
            user.userId,
            cost,
            user.userId,
            itemId,
          )
          .run();
        if (!result.meta.changes) return json({ error: "not_enough_gems" }, 409);
        return json(await state(user.userId));
      }
      // One guarded write prevents two purchases from spending the same balance.
      const result = await db
        .prepare(
          `INSERT INTO cosmetic_purchases (user_id,item_id,price,purchased_at)
    SELECT ?,?,?,? WHERE ? - COALESCE((SELECT SUM(price) FROM cosmetic_purchases WHERE user_id=?),0) >= ?
    AND NOT EXISTS (SELECT 1 FROM cosmetic_purchases WHERE user_id=? AND item_id=?)`,
        )
        .bind(
          user.userId,
          itemId,
          product.price,
          Date.now(),
          current.earnedCoins,
          user.userId,
          product.price,
          user.userId,
          itemId,
        )
        .run();
      if (!result.meta.changes) return json({ error: "not_enough_coins" }, 409);
    } else return json({ error: "invalid_action" }, 400);
    return json(await state(user.userId));
  } catch {
    return json({ error: "cosmetics_unavailable" }, 503);
  }
}
