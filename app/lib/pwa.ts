"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** The event Chromium fires when the app can be installed; not in the DOM typings. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Registers the service worker; only in production, where files are fingerprinted. */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  const register = () =>
    void navigator.serviceWorker
      .register("/sw.js")
      .then(async () => {
        const registration = await navigator.serviceWorker.ready;
        // The first page loaded before the worker existed: preserve its already loaded assets too.
        const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
        registration.active?.postMessage({ type: "PREPARE_OFFLINE", urls });
      })
      .catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

/** Whether the browser reports no connection. */
export function useOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline;
}

export type InstallPlatform = "ios" | "android" | "desktop";

/** Listen for the browser prompt as soon as the app shell mounts. */
export function useInstall() {
  const prompt = useRef<InstallPrompt | null>(null);
  const prompting = useRef(false);
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const device = navigator as Navigator & { standalone?: boolean };
    const ua = device.userAgent;
    const appleMobile =
      /iPhone|iPad|iPod/i.test(ua) || (device.platform === "MacIntel" && device.maxTouchPoints > 1);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateMode = () => setStandalone(displayMode.matches || device.standalone === true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
    };
    const onInstalled = () => {
      prompt.current = null;
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener("change", updateMode);
    updateMode();
    setPlatform(appleMobile ? "ios" : /Android/i.test(ua) ? "android" : "desktop");

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode.removeEventListener("change", updateMode);
    };
  }, []);
  const requestInstall = useCallback(async () => {
    if (prompting.current) return true;
    const pending = prompt.current;
    if (!pending) return false;
    // Each browser prompt may be used once, directly from a click.
    prompt.current = null;
    prompting.current = true;
    try {
      await pending.prompt();
      if ((await pending.userChoice).outcome === "accepted") setInstalled(true);
      return true;
    } catch {
      return false;
    } finally {
      prompting.current = false;
    }
  }, []);
  return { platform: standalone || installed ? null : platform, requestInstall };
}
