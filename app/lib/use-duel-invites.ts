"use client";
import { useEffect, useRef, useState } from "react";
import { authHeaders } from "@/app/lib/auth-headers";

/**
 * Watches for challenges from friends while the player is elsewhere in the app: a slow poll,
 * not the game's own, that counts pending invitations and says when a new one arrives.
 */
export function useDuelInvites(
  userId: string | undefined,
  onInvite: (from: string) => void,
  intervalMs = 15_000,
) {
  const [pending, setPending] = useState(0);
  const seen = useRef(new Set<string>());
  const notifyRef = useRef(onInvite);
  useEffect(() => {
    notifyRef.current = onInvite;
  });
  useEffect(() => {
    if (!userId) return;
    let live = true;
    seen.current = new Set();
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/duels", {
          cache: "no-store",
          headers: await authHeaders(),
        });
        if (!response.ok || !live) return;
        const data = (await response.json()) as {
          incoming: { id: string; from: { username: string } }[];
        };
        setPending(data.incoming.length);
        for (const invite of data.incoming)
          if (!seen.current.has(invite.id)) {
            seen.current.add(invite.id);
            notifyRef.current(invite.from.username);
          }
      } catch {
        // Offline for a moment: the next check will catch up.
      }
    };
    void check();
    const timer = setInterval(() => void check(), intervalMs);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [userId, intervalMs]);
  return pending;
}
