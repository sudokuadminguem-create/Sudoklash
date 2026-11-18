/**
 * The key shared by both directions of a friendship: the two ids in code-unit order, so it
 * matches the keys already stored whichever player is asking.
 */
export function friendPairKey(a: string, b: string) {
  return [a, b].sort((x, y) => (x < y ? -1 : Number(x > y))).join(":");
}
