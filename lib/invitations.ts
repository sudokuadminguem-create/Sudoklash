export const invitationTiers = [
  { count: 5, colors: ["electric", "mint", "coral"] },
  { count: 10, colors: ["turquoise", "amethyst", "fuchsia"] },
  { count: 15, colors: ["ice", "emerald", "copper"] },
  { count: 20, colors: ["aurora", "sunset", "lagoon"] },
  { count: 25, colors: ["gold", "rose-gold", "solar-gold"] },
] as const;

export type InvitationColor = (typeof invitationTiers)[number]["colors"][number];
export type InvitationState = {
  code: string;
  count: number;
  selected: string | null;
  rewards: { tier: number; color: string }[];
};

export function isInviteCode(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
}

export function colorTier(value: unknown) {
  return invitationTiers.find(({ colors }) => colors.some((color) => value === color));
}
