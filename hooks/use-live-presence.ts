"use client";

import { useEffect, useState } from "react";

export function useLivePresence() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!globalThis.crypto?.randomUUID) return;
    const tabId = crypto.randomUUID();
    let browserId: string = crypto.randomUUID();
    try {
      const saved = localStorage.getItem("sudoklash:presence-browser");
      if (saved && /^[0-9a-f-]{36}$/.test(saved)) browserId = saved;
      else localStorage.setItem("sudoklash:presence-browser", browserId);
    } catch {
      /* Count this tab if persistent storage is unavailable. */
    }
    let revision = 0,
      live = true;
    const message = (active: boolean) =>
      JSON.stringify({ tabId, browserId, active, revision: ++revision });
    const heartbeat = async () => {
      if (document.hidden) return;
      const body = message(true),
        sent = revision;
      try {
        const r = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!r.ok) throw new Error("presence");
        const { count } = (await r.json()) as { count: number };
        if (live && sent === revision && !document.hidden) setCount(count);
      } catch {
        if (live && sent === revision) setCount(null);
      }
    };
    const leave = () => {
      const body = message(false);
      if (!navigator.sendBeacon?.("/api/presence", body))
        void fetch("/api/presence", { method: "POST", body, keepalive: true }).catch(() => {});
    };
    const visibility = () => {
      if (document.hidden) leave();
      else void heartbeat();
    };
    void heartbeat();
    const timer = window.setInterval(heartbeat, 10_000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", visibility);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", visibility);
      leave();
    };
  }, []);
  return count;
}
