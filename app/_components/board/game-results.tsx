import { useState } from "react";
import { Share2, ShieldCheck, Trophy, X } from "lucide-react";
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
  const left = hintLimit - hintsUsed;
  return (
    <div className="game-footer">
      <span>
        3 vies par grille ·{" "}
        {hintLimit
          ? `${left} indice${left === 1 ? "" : "s"} restant${left === 1 ? "" : "s"}`
          : "Aides désactivées"}
      </span>
      <span>
        Progression <b>{progress}%</b>
      </span>
      <span className="fair">
        <ShieldCheck />
        {competitive ? "Mode compétitif" : "Solution unique vérifiée"}
      </span>
    </div>
  );
}

/** Notices under the board: a wrong digit, or digits that could not be checked. */
export function BoardNotices(props: { mistakes: number; unverified: number; onRetry: () => void }) {
  const { mistakes, unverified } = props;
  return (
    <>
      {mistakes > 0 && mistakes < 3 && (
        <p className="grid-invalid" role="status">
          Chiffre incorrect. {3 - mistakes} {3 - mistakes === 1 ? "vie restante" : "vies restantes"}
          .
        </p>
      )}
      {unverified > 0 && (
        <p className="grid-invalid" role="alert">
          {unverified === 1
            ? "Impossible de vérifier ce chiffre."
            : `Impossible de vérifier ${unverified} chiffres.`}{" "}
          <button className="retry-mistake" onClick={props.onRetry}>
            Réessayer
          </button>
        </p>
      )}
    </>
  );
}

/** Shown once the three lives are gone. */
export function LossResult({ onNewGame }: { onNewGame?: () => void }) {
  return (
    <div className="loss-result" role="status">
      <X />
      <h3>Grille perdue</h3>
      <p>Tu as utilisé tes trois vies. Cette grille ne peut plus être terminée.</p>
      {onNewGame && <button onClick={onNewGame}>Nouvelle grille</button>}
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
      <h3>{soloExperience && experience === "saving" ? "Grille terminée !" : "Victoire !"}</h3>
      <p>Grille {props.difficulty} terminée</p>
      <dl className="victory-stats">
        <div>
          <dt>Temps</dt>
          <dd>{props.time}</dd>
        </div>
        <div>
          <dt>Erreurs</dt>
          <dd>{props.mistakes}/3</dd>
        </div>
        <div>
          <dt>Indices</dt>
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
              <small>Expérience ajoutée à ton compte</small>
              {props.experienceTotal !== null && <ExperienceProgress gained={experience} totalXp={props.experienceTotal} />}
            </>
          ) : experience === "saving" ? (
            <small>Enregistrement de ton expérience…</small>
          ) : experience === "guest" ? (
            <>
              <small>Connecte-toi pour gagner de l’XP sur les prochaines grilles.</small>
              {props.onConnect && (
                <button className="solo-xp-connect" onClick={props.onConnect}>
                  Se connecter
                </button>
              )}
            </>
          ) : experience === "error" ? (
            <small>Résultat non enregistré : aucun XP ajouté.</small>
          ) : null}
        </div>
      )}
      <div className="victory-actions">
        <button className="victory-share" onClick={() => void share()}>
          <Share2 />
          {shared ? "Copié !" : "Partager"}
        </button>
        {onNewGame ? (
          <button onClick={onNewGame} disabled={soloExperience && experience === "saving"}>
            Nouvelle grille
          </button>
        ) : (
          <small>Enregistrement du temps…</small>
        )}
      </div>
    </div>
  );
}
