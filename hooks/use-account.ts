"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { authHeaders } from "@/app/lib/auth-headers";
import { supabase } from "@/app/lib/supabase";

export type Profile = {
  id: string;
  username: string | null;
  usernameColor?: string | null;
  display_name: string;
  avatar_url: string | null;
  last_seen: string;
};
export type AccountState = { loading: boolean; user: User | null; profile: Profile | null };
export type Account = ReturnType<typeof useAccount>;

/** Signed-in Supabase user and their Sudoku Clash profile. */
export function useAccount() {
  const [state, setState] = useState<AccountState>({ loading: true, user: null, profile: null });
  const revision = useRef(0);
  const load = useCallback(async (user: User | null) => {
    const version = ++revision.current;
    if (!user) {
      setState({ loading: false, user: null, profile: null });
      return;
    }
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/profile", { headers, cache: "no-store" });
      if (!response.ok) throw new Error("profile_unavailable");
      const data = (await response.json()) as { profile: Profile | null };
      if (version === revision.current) setState({ loading: false, user, profile: data.profile });
    } catch {
      if (version === revision.current) setState({ loading: false, user, profile: null });
    }
  }, []);
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout>;
    const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      ++revision.current;
      clearTimeout(pending);
      if (!session) void load(null);
      else pending = setTimeout(() => void load(session.user), 0);
    }).data;
    return () => {
      subscription.unsubscribe();
      clearTimeout(pending);
      ++revision.current;
    };
  }, [load]);
  return { ...state, refresh: () => load(state.user) };
}
