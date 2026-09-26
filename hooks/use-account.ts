"use client";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { authHeaders } from "@/app/lib/auth-headers";
import { supabase } from "@/app/lib/supabase";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  last_seen: string;
};
export type AccountState = { loading: boolean; user: User | null; profile: Profile | null };
export type Account = ReturnType<typeof useAccount>;

/** Signed-in Supabase user and their Sudoku Clash profile. */
export function useAccount() {
  const [state, setState] = useState<AccountState>({ loading: true, user: null, profile: null });
  const load = useCallback(async (user: User | null) => {
    if (!user) {
      setState({ loading: false, user: null, profile: null });
      return;
    }
    const headers = await authHeaders();
    try {
      const response = await fetch("/api/profile", { headers, cache: "no-store" });
      if (!response.ok) throw new Error("profile_unavailable");
      const data = (await response.json()) as { profile: Profile | null };
      setState({ loading: false, user, profile: data.profile });
    } catch {
      setState({ loading: false, user, profile: null });
    }
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session?.user ?? null), 0);
    }).data;
    return () => subscription.unsubscribe();
  }, [load]);
  return { ...state, refresh: () => load(state.user) };
}
