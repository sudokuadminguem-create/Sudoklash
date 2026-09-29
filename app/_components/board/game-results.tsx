import { useState } from "react";
import { Share2, ShieldCheck, Trophy, X } from "lucide-react";
import { useI18n } from "@/app/lib/i18n";
import type { ExperienceState } from "./types";
import { ExperienceProgress } from "../experience-progress";

type FooterProps = {
  hintLimit: number;
  hintsUsed: number;
  progress: number;
  competitive: boolean;
};

/** Lives and hints rule, progress and the fairness note. */
export function GameFooter({ hintLimit, hintsUsed, progress, competitive }: FooterProps) {
  const { t } = useI18n();
  const left = hintLimit - hintsUsed;
  return (
    <div className="game-footer">
      <span>
        {t("footer.rules", {
          hints: hintLimit ? t("footer.hints", { count: left }) : t("footer.noHelp"),
        })}
      </span>
      <span>
        {t("footer.progress")} <b>{progress}%</b>
      </span>
      <span className="fair">
        <ShieldCheck />
        {competitive ? t("footer.competitive") : t("footer.unique")}
      </span>
    </div>
  );
}

/** Notices under the board: a wrong digit, or digits that could not be checked. */
export function BoardNotices(props: { mistakes: number; unverified: number; onRetry: () => void }) {
  const { mistakes, unverified } = props;
  const { t } = useI18n();
  return (
    <>
      {mistakes > 0 && mistakes < 3 && (
        <p className="grid-invalid">{t("notice.wrong", { count: 3 - mistakes })}</p>
      )}
      {unverified > 0 && (
        <p className="grid-invalid" role="alert">
          {t("notice.unverified", { count: unverified })}{" "}
          <button className="retry-mistake" onClick={props.onRetry}>
            {t("notice.retry")}
          </button>
        </p>
      )}
    </>
  );
}

/** Shown once the three lives are gone. */
export function LossResult({ onNewGame }: { onNewGame?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="loss-result" role="status">
      <X />
      <h3>{t("loss.title")}</h3>
      <p>{t("loss.copy")}</p>
      {onNewGame && <button onClick={onNewGame}>{t("loss.newGrid")}</button>}
    </div>
  );
}

type VictoryProps = {
  difficulty: string;
  time: string;
  mistakes: number;
  hintsUsed: number;
  record: { label: string; best: boolean } | null;
  soloExperience: boolean;
  experience: ExperienceState;
  experienceTotal: number | null;
  shareText: string;
  onConnect?: () => void;
  onNewGame?: () => void;
};

/** Victory screen: the game in numbers, the XP earned and the buttons to share or replay. */
export function VictoryPanel(props: VictoryProps) {
  const { experience, soloExperience, onNewGame } = props;
  const { t } = useI18n();
  const [shared, setShared] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: props.shareText });
      else {
        await navigator.clipboard.writeText(props.shareText);
        setShared(true);
      }
    } catch {
      // Sharing cancelled or not allowed: nothing to do.
    }
  };
  return (
    <div className={`victory${typeof experience === "number" ? " reward-ready" : ""}`}>
      <Trophy />
      <h3>
        {soloExperience && experience === "saving" ? t("victory.doneSaving") : t("victory.title")}
      </h3>
      <p>{t("victory.solved", { level: props.difficulty })}</p>
      <dl className="victory-stats">
        <div>
          <dt>{t("victory.time")}</dt>
          <dd>{props.time}</dd>
        </div>
        <div>
          <dt>{t("victory.mistakes")}</dt>
          <dd>{props.mistakes}/3</dd>
        </div>
        <div>
          <dt>{t("victory.hints")}</dt>
          <dd>{props.hintsUsed}</dd>
        </div>
      </dl>
      {props.record && (
        <span className={`victory-record ${props.record.best ? "best" : ""}`}>
          {props.record.best && <Trophy />}
          {props.record.label}
        </span>
      )}
      {soloExperience && (
        <div className="solo-xp" role="status" aria-live="polite">
          {typeof experience === "number" ? (
            <>
              <span className="solo-xp-burst" aria-hidden="true">
                ✦
              </span>
              <strong key={experience}>+{experience} XP</strong>
              <small>{t("victory.xpNote")}</small>
              {props.experienceTotal !== null && (
                <ExperienceProgress gained={experience} totalXp={props.experienceTotal} />
              )}
            </>
          ) : experience === "saving" ? (
            <small>{t("victory.saving")}</small>
          ) : experience === "guest" ? (
            <>
              <small>{t("victory.guest")}</small>
              {props.onConnect && (
                <button className="solo-xp-connect" onClick={props.onConnect}>
                  {t("victory.signIn")}
                </button>
              )}
            </>
          ) : experience === "error" ? (
            <small>{t("victory.notSaved")}</small>
          ) : null}
        </div>
      )}
      <div className="victory-actions">
        <button className="victory-share" onClick={() => void share()}>
          <Share2 />
          {shared ? t("victory.copied") : t("victory.share")}
        </button>
        {onNewGame ? (
          <button onClick={onNewGame} disabled={soloExperience && experience === "saving"}>
            {t("victory.newGrid")}
          </button>
        ) : (
          <small>{t("victory.savingTime")}</small>
        )}
      </div>
    </div>
  );
}
