"use client";
import type { CSSProperties } from "react";
import { levelProgressForXp } from "@/lib/cosmetics";

export function ExperienceProgress({
  gained,
  totalXp,
}: Readonly<{ gained: number; totalXp: number }>) {
  const before = levelProgressForXp(Math.max(0, totalXp - gained));
  const after = levelProgressForXp(totalXp);
  const previous = before.level === after.level ? (before.levelXp / before.nextLevelXp) * 100 : 0;
  const current = (after.levelXp / after.nextLevelXp) * 100;
  return (
    <section
      className="experience-progress"
      aria-label="Expérience gagnée et progression du niveau"
    >
      <div className="experience-progress-heading">
        <strong>
          {after.level > before.level ? `Niveau ${after.level} atteint !` : `Niveau ${after.level}`}
        </strong>
        <b>+{gained} XP</b>
      </div>
      <progress
        className="sr-only"
        aria-label={`Progression vers le niveau ${after.level + 1}`}
        max={after.nextLevelXp}
        value={after.levelXp}
      />
      <div className="experience-progress-track" aria-hidden="true">
        <span style={{ "--xp-from": `${previous}%`, "--xp-to": `${current}%` } as CSSProperties} />
      </div>
      <small>
        {after.levelXp.toLocaleString("fr-FR")} / {after.nextLevelXp.toLocaleString("fr-FR")} XP
        vers le niveau {after.level + 1}
      </small>
    </section>
  );
}
