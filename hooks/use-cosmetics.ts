"use client";
import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/auth-headers";
import type { AccountState } from "@/hooks/use-account";

export type CosmeticState = {
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  coins: number;
  counts: { solo: number; daily: number; weekly: number; wins: number; losses: number };
  ownedAvatars: string[];
  ownedThemes: string[];
  unlockedFrames: string[];
  achievementFrames: { id: string; name: string; rarity: "simple" | "epic" | "legendary" | "majestic" }[];
  avatarId: string;
  frameId: string;
  frameSelection: string;
  rank: string;
  rankName: string;
  rankPoints: number;
  customAvatar: string | null;
  themeId: string;
};

export type CosmeticAction =
  | "equip_avatar"
  | "equip_frame"
  | "buy_avatar"
  | "equip_theme"
  | "buy_theme"
  | "upload_avatar"
  | "remove_avatar";

export type Cosmetics = ReturnType<typeof useCosmetics>;

/** Progression, currency and cosmetic choices of the signed-in player. */
export function useCosmetics(account: AccountState) {
  const [state, setState] = useState<CosmeticState | null>(null),
    [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!account.user) {
      setState(null);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/cosmetics", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      if (!response.ok) throw Error("load");
      setState((await response.json()) as CosmeticState);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [account.user?.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const action = async (action: CosmeticAction, id: string) => {
    const response = await fetch("/api/cosmetics", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ action, id }),
    });
    if (!response.ok) throw Error(((await response.json()) as { error: string }).error);
    const updated = (await response.json()) as CosmeticState;
    setState(updated);
    return updated;
  };
  return { state, loading, refresh, action };
}
