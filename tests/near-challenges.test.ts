import { expect, it } from "vitest";
import { closestChallenges } from "@/app/_components/near-challenges";
import type { Achievement } from "@/lib/achievement-frames";

const challenge = (id: string, progress: number, target: number, rarity: Achievement["rarity"], unlocked = false) =>
  ({ id, name: id, progress, target, rarity, unlocked }) as Achievement & { progress: number; unlocked: boolean };

it("chooses the three closest unfinished challenges, then presents them by descending rarity", () => {
  const items = [
    challenge("classique", 9, 10, "simple"),
    challenge("epique", 85, 100, "epic"),
    challenge("legendaire", 8, 10, "legendary"),
    challenge("loin", 7, 10, "legendary"),
    challenge("termine", 10, 10, "legendary", true),
  ];
  expect(closestChallenges(items).map((item) => item.id)).toEqual(["legendaire", "epique", "classique"]);
});
