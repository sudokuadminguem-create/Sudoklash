"use client";
import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { refillPack, type OfflineGrid } from "@/app/lib/offline-pack";
import { registerServiceWorker, useOffline } from "@/app/lib/pwa";

/** Asks for a guest grid: `practice` keeps the request from touching a signed-in player's game. */
export async function fetchPracticeGrid(level: string): Promise<OfflineGrid> {
  const response = await fetch("/api/solo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", difficulty: level, practice: true }),
  });
  if (!response.ok) throw new Error("solo_unavailable");
  return (await response.json()) as OfflineGrid;
}

/** Installs the service worker, stocks grids for offline play and tells when we are offline. */
export function PwaStatus() {
  const offline = useOffline();
  useEffect(() => {
    registerServiceWorker();
    // Not on a metered connection, and not while the page is still loading.
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (!navigator.onLine || connection?.saveData) return;
    const run = () => void refillPack(fetchPracticeGrid);
    const idle = window.requestIdleCallback;
    if (idle) {
      const handle = idle(run, { timeout: 10_000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(run, 3000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff aria-hidden="true" />
      Hors ligne : les parties d’entraînement solo restent disponibles, sans XP.
    </div>
  );
}
