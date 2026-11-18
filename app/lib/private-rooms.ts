import { authHeaders } from "./auth-headers";
import type { Cage, VariantId } from "@/lib/variants";

export type Room = {
  id: string;
  code: string;
  host_id: string;
  max_players: number;
  difficulty: string;
  variant: "classic" | VariantId;
  puzzle: string;
  cages: Cage[];
  started_at: number | null;
  winner_id: string | null;
};
export type RoomPlayer = {
  user_id: string;
  username: string | null;
  is_ready: number;
  progress: number;
};
export type RoomSnapshot = { room: Room; players: RoomPlayer[] };
export async function roomRequest<T>(body?: Record<string, unknown>, id?: string): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(
    id ? `/api/rooms?id=${encodeURIComponent(id)}` : "/api/rooms",
    body
      ? {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { headers, cache: "no-store" },
  );
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Salon indisponible.");
  return data;
}
