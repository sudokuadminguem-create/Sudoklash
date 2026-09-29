import { Flame, Heart, Timer } from "lucide-react";
import { MAX_MISTAKES } from "@/app/lib/board-logic";

type BoardHeaderProps = {
  eyebrow: string;
  title: string;
  mistakes: number;
  time: string;
  showTimer: boolean;
};

/** Title of the game with the lives left and the clock. */
export function BoardHeader({ eyebrow, title, mistakes, time, showTimer }: BoardHeaderProps) {
  const lives = MAX_MISTAKES - mistakes;
  return (
    <div className="game-top">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <div className="game-status">
        <div
          className="lives"
          role="status"
          aria-label={`${Math.max(0, lives)} ${lives === 1 ? "vie restante" : "vies restantes"} sur 3`}
        >
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              className={i < lives ? "full" : "empty"}
              fill={i < lives ? "currentColor" : "none"}
            />
          ))}
        </div>
        {showTimer && (
          <div className="timer">
            <Timer />
            {time}
          </div>
        )}
      </div>
    </div>
  );
}

type ReadyGateProps = { label: string; busy: boolean; onReady: () => void };

/** Hides the grid of a timed challenge until the player says they are ready. */
export function ReadyGate({ label, busy, onReady }: ReadyGateProps) {
  return (
    <div className="ready-gate">
      <Flame />
      <span>{label}</span>
      <h3>À vous de jouer</h3>
      <p>
        La grille restera masquée jusqu’au départ. Le chronomètre démarre dès que vous appuyez sur «
        Prêt ».
      </p>
      <button onClick={onReady} disabled={busy}>
        {busy ? "Démarrage…" : "Je suis prêt"}
      </button>
      <small>Une seule tentative jusqu’à la prochaine grille</small>
    </div>
  );
}

type RaceBarProps = {
  meName: string;
  opponentName: string;
  progress: number;
  opponentProgress: number;
  total: number;
};

/** Progress of both players in a race. */
export function RaceBar({ meName, opponentName, progress, opponentProgress, total }: RaceBarProps) {
  return (
    <div className="opponents">
      <span className="me">
        <i />
        {meName}{" "}
        <b>
          {progress}/{total}
        </b>
      </span>
      <div className="race">
        <em style={{ width: `${(progress / total) * 100}%` }} />
      </div>
      <span>
        <i />
        {opponentName}{" "}
        <b>
          {opponentProgress}/{total}
        </b>
      </span>
    </div>
  );
}
