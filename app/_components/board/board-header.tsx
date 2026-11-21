import { pseudonymClass } from "@/app/lib/pseudonym";
import { Flame, Heart, Timer } from "lucide-react";
import { MAX_MISTAKES } from "@/app/lib/board-logic";
import { useI18n } from "@/app/lib/i18n";

type BoardHeaderProps = {
  eyebrow: string;
  title: string;
  mistakes: number;
  time: string;
  showTimer: boolean;
};

/** Title of the game with the lives left and the clock. */
export function BoardHeader({
  eyebrow,
  title,
  mistakes,
  time,
  showTimer,
}: Readonly<BoardHeaderProps>) {
  const { t } = useI18n();
  const lives = MAX_MISTAKES - mistakes;
  return (
    <div className="game-top">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <div className="game-status">
        <output className="lives" aria-label={t("header.lives", { count: Math.max(0, lives) })}>
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              className={i < lives ? "full" : "empty"}
              fill={i < lives ? "currentColor" : "none"}
            />
          ))}
        </output>
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
export function ReadyGate({ label, busy, onReady }: Readonly<ReadyGateProps>) {
  const { t } = useI18n();
  return (
    <div className="ready-gate">
      <Flame />
      <span>{label}</span>
      <h3>{t("gate.title")}</h3>
      <p>{t("gate.copy")}</p>
      <button onClick={onReady} disabled={busy}>
        {busy ? t("gate.busy") : t("gate.ready")}
      </button>
      <small>{t("gate.note")}</small>
    </div>
  );
}

type RaceBarProps = {
  meName: string;
  opponentName: string;
  meColor?: string | null;
  opponentColor?: string | null;
  progress: number;
  opponentProgress: number;
  total: number;
};

/** Progress of both players in a race. */
export function RaceBar({
  meName,
  opponentName,
  meColor,
  opponentColor,
  progress,
  opponentProgress,
  total,
}: RaceBarProps) {
  return (
    <div className="opponents">
      <span className="me">
        <i />
        <strong className={pseudonymClass(meColor)}>{meName}</strong>{" "}
        <b>
          {progress}/{total}
        </b>
      </span>
      <div className="race">
        <em style={{ width: `${(progress / total) * 100}%` }} />
      </div>
      <span>
        <i />
        <strong className={pseudonymClass(opponentColor)}>{opponentName}</strong>{" "}
        <b>
          {opponentProgress}/{total}
        </b>
      </span>
    </div>
  );
}
