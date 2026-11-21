import { colorTier } from "@/lib/invitations";
export function pseudonymClass(color?: string | null) {
  return colorTier(color) ? `invite-name invite-name-${color}` : undefined;
}
