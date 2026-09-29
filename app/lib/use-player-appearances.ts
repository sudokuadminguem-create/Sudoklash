"use client";

import { useEffect, useState } from "react";

export type PlayerAppearance = { avatarId: string; frameId: string; image: string | null };

export function usePlayerAppearances(ids: string[]) {
  const key = [...new Set(ids.filter(Boolean))].sort().join(",");
  const [appearances, setAppearances] = useState<Record<string, PlayerAppearance>>({});
  useEffect(() => {
    if (!key) return;
    let active = true;
    const values = key.split(",");
    const batches = Array.from({ length: Math.ceil(values.length / 10) }, (_, index) =>
      values.slice(index * 10, index * 10 + 10),
    );
    void Promise.all(
      batches.map(async (batch) => {
        const response = await fetch(
          `/api/players/appearance?ids=${encodeURIComponent(batch.join(","))}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("appearance_unavailable");
        return (await response.json()) as { appearances: Array<PlayerAppearance & { id: string }> };
      }),
    )
      .then((results) => {
        if (active)
          setAppearances(
            Object.fromEntries(
              results
                .flatMap((result) => result.appearances)
                .map(({ id, ...appearance }) => [id, appearance]),
            ),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key]);
  return appearances;
}
