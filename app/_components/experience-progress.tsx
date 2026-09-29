"use client";
import type { CSSProperties } from "react";
import { levelProgressForXp } from "@/lib/cosmetics";

export function ExperienceProgress({ gained, totalXp }: { gained: number; totalXp: number }) {
  const before = levelProgressForXp(Math.max(0, totalXp - gained));
  const after = levelProgressForXp(totalXp);
  const previous = before.level === after.level ? before.levelXp / before.nextLevelXp * 100 : 0;
  const current = after.levelXp / after.nextLevelXp * 100;
  return (
    <div className="experience-progress" role="group" aria-label="Expérience gagnée et progression du niveau">
      <div className="experience-progress-heading">
        <strong>{after.level > before.level ? `Niveau ${after.level} atteint !` : `Niveau ${after.level}`}</strong>
        <b>+{gained} XP</b>
      </div>
      <div className="experience-progress-track" role="progressbar" aria-label={`Progression vers le niveau ${after.level + 1}`} aria-valuemin={0} aria-valuemax={after.nextLevelXp} aria-valuenow={after.levelXp}>
        <span style={{ "--xp-from": `${previous}%`, "--xp-to": `${current}%` } as CSSProperties} />
      </div>
      <small>{after.levelXp.toLocaleString("fr-FR")} / {after.nextLevelXp.toLocaleString("fr-FR")} XP vers le niveau {after.level + 1}</small>
    </div>
  );
}
