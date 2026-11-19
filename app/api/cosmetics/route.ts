import { counts } from "@/lib/player-counts";
import { settleTournaments, tournamentNetSQL } from "@/lib/tournament-wallet";
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

async function state(userId: string) {
  const db = env.DB!;
  await settleTournaments(db, Date.now(), userId);
  const [score, selection, purchases, rating, image, premium, tournament] = await Promise.all([
    counts(db, userId),
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
    db.prepare(`SELECT ${tournamentNetSQL} AS net`).bind(userId).first<{ net: number }>(),
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
      progress.earnedCoins +
        (tournament?.net ?? 0) -
        purchases.results.reduce((sum, p) => sum + p.price, 0),
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

type CosmeticsState = Awaited<ReturnType<typeof state>>;
type ActionBody = { action: string; id: string; currency?: unknown };
type ActionContext = { db: D1Database; userId: string; current: CosmeticsState; body: ActionBody };
/** Handles one action; a null result answers with the refreshed cosmetics state. */
type ActionHandler = (context: ActionContext) => Promise<Response | null>;

const insertCosmeticsSQL = (column: "avatar_id" | "frame_id" | "theme_id") =>
  `INSERT INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET ${column}=excluded.${column}`;
const ensureCosmeticsRow = ({ db, userId, current }: ActionContext) =>
  db
    .prepare(
      "INSERT OR IGNORE INTO player_cosmetics (user_id,avatar_id,frame_id,theme_id) VALUES (?,?,?,?)",
    )
    .bind(userId, current.avatarId, current.frameSelection, current.themeId);

const equipAvatar: ActionHandler = async ({ db, userId, current, body }) => {
  if (
    !(avatars.some((a) => a.id === body.id) || body.id === "custom") ||
    !current.ownedAvatars.includes(body.id)
  )
    return json({ error: "avatar_locked" }, 403);
  await db
    .prepare(insertCosmeticsSQL("avatar_id"))
    .bind(userId, body.id, current.frameSelection, current.themeId)
    .run();
  return null;
};

const uploadAvatar: ActionHandler = async ({ db, userId, current, body }) => {
  if (body.id.length > MAX_AVATAR_IMAGE_LENGTH || !AVATAR_IMAGE_PATTERN.test(body.id))
    return json({ error: "invalid_image" }, 400);
  await db.batch([
    db
      .prepare(
        "INSERT INTO player_avatar_images (user_id,image_data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET image_data=excluded.image_data,updated_at=excluded.updated_at",
      )
      .bind(userId, body.id, Date.now()),
    db
      .prepare(insertCosmeticsSQL("avatar_id"))
      .bind(userId, "custom", current.frameSelection, current.themeId),
  ]);
  return null;
};

const removeAvatar: ActionHandler = async ({ db, userId }) => {
  await db.batch([
    db.prepare("DELETE FROM player_avatar_images WHERE user_id=?").bind(userId),
    db
      .prepare(
        "UPDATE player_cosmetics SET avatar_id='nova' WHERE user_id=? AND avatar_id='custom'",
      )
      .bind(userId),
  ]);
  return null;
};

const buyPremium: ActionHandler = async ({ db, userId, current, body }) => {
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
      userId,
      itemId,
      cost,
      Date.now(),
      userId,
      userId,
      cost,
      userId,
      itemId,
      current.premiumSpent,
      userId,
    )
    .run();
  return result.meta.changes ? null : json({ error: "not_enough_gems" }, 409);
};

const equipEffect: ActionHandler = async (context) => {
  const { db, userId, current, body } = context;
  if (!current.ownedEffects.includes(body.id)) return json({ error: "effect_locked" }, 403);
  await db.batch([
    ensureCosmeticsRow(context),
    db
      .prepare("UPDATE player_cosmetics SET victory_effect_id=? WHERE user_id=?")
      .bind(body.id, userId),
  ]);
  return null;
};

const equipFrame: ActionHandler = async ({ db, userId, current, body }) => {
  if (body.id !== "rank_auto" && body.id !== "none" && !current.unlockedFrames.includes(body.id))
    return json({ error: "frame_locked" }, 403);
  await db
    .prepare(insertCosmeticsSQL("frame_id"))
    .bind(userId, current.avatarId, body.id, current.themeId)
    .run();
  return null;
};

const equipTheme: ActionHandler = async ({ db, userId, current, body }) => {
  if (!current.ownedThemes.includes(body.id)) return json({ error: "theme_locked" }, 403);
  await db
    .prepare(insertCosmeticsSQL("theme_id"))
    .bind(userId, current.avatarId, current.frameSelection, body.id)
    .run();
  return null;
};

const equipProfileReward =
  (card: boolean): ActionHandler =>
  async (context) => {
    const { db, userId, current, body } = context;
    if (!(card ? current.ownedCards : current.ownedTitles).includes(body.id))
      return json({ error: "reward_locked" }, 403);
    await db.batch([
      ensureCosmeticsRow(context),
      db
        .prepare(
          card
            ? "UPDATE player_cosmetics SET profile_card_id=? WHERE user_id=?"
            : "UPDATE player_cosmetics SET profile_title_id=? WHERE user_id=?",
        )
        .bind(body.id, userId),
    ]);
    return null;
  };

type ShopKind = "avatar" | "theme" | "frame";
const shopCatalog: Record<
  ShopKind,
  {
    products: readonly { id: string; price: number }[];
    owned: (current: CosmeticsState) => string[];
  }
> = {
  frame: { products: shopFrames, owned: (current) => current.unlockedFrames },
  avatar: { products: shopAvatars, owned: (current) => current.ownedAvatars },
  theme: { products: gridThemes, owned: (current) => current.ownedThemes },
};

async function buyWithGems(db: D1Database, userId: string, itemId: string, price: number) {
  const cost = premiumPrice(price);
  const result = await db
    .prepare(
      `INSERT INTO cosmetic_purchases (user_id,item_id,price,premium_price,purchased_at)
          SELECT ?,?,0,?,? WHERE COALESCE((SELECT SUM(gems) FROM premium_credits WHERE user_id=?),0) - COALESCE((SELECT SUM(premium_price) FROM cosmetic_purchases WHERE user_id=?),0) >= ?
          AND NOT EXISTS (SELECT 1 FROM cosmetic_purchases WHERE user_id=? AND item_id=?)`,
    )
    .bind(userId, itemId, cost, Date.now(), userId, userId, cost, userId, itemId)
    .run();
  return result.meta.changes ? null : json({ error: "not_enough_gems" }, 409);
}

async function buyWithCoins(
  db: D1Database,
  userId: string,
  itemId: string,
  price: number,
  earnedCoins: number,
) {
  // One guarded write prevents two purchases from spending the same balance.
  const result = await db
    .prepare(
      `INSERT INTO cosmetic_purchases (user_id,item_id,price,purchased_at)
    SELECT ?,?,?,? WHERE ? + ${tournamentNetSQL} - COALESCE((SELECT SUM(price) FROM cosmetic_purchases WHERE user_id=?),0) >= ?
    AND NOT EXISTS (SELECT 1 FROM cosmetic_purchases WHERE user_id=? AND item_id=?)`,
    )
    .bind(userId, itemId, price, Date.now(), earnedCoins, userId, userId, price, userId, itemId)
    .run();
  return result.meta.changes ? null : json({ error: "not_enough_coins" }, 409);
}

const buyShopItem =
  (kind: ShopKind): ActionHandler =>
  async ({ db, userId, current, body }) => {
    const catalog = shopCatalog[kind];
    const product = catalog.products.find((p) => p.id === body.id);
    if (!product) return json({ error: "invalid_item" }, 400);
    if (catalog.owned(current).includes(product.id)) return json(current);
    const itemId = `${kind}:${product.id}`;
    if (body.currency !== undefined && body.currency !== "coins" && body.currency !== "gems")
      return json({ error: "invalid_currency" }, 400);
    if (body.currency === "gems") return buyWithGems(db, userId, itemId, product.price);
    return buyWithCoins(db, userId, itemId, product.price, current.earnedCoins);
  };

const actions: Record<string, ActionHandler> = {
  equip_avatar: equipAvatar,
  upload_avatar: uploadAvatar,
  remove_avatar: removeAvatar,
  buy_premium: buyPremium,
  equip_effect: equipEffect,
  equip_frame: equipFrame,
  equip_theme: equipTheme,
  equip_profile_card: equipProfileReward(true),
  equip_profile_title: equipProfileReward(false),
  buy_avatar: buyShopItem("avatar"),
  buy_theme: buyShopItem("theme"),
  buy_frame: buyShopItem("frame"),
};

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
    const handler = Object.hasOwn(actions, body.action) ? actions[body.action] : undefined;
    if (!handler) return json({ error: "invalid_action" }, 400);
    const context = { db, userId: user.userId, current, body: body as ActionBody };
    return (await handler(context)) ?? json(await state(user.userId));
  } catch {
    return json({ error: "cosmetics_unavailable" }, 503);
  }
}
