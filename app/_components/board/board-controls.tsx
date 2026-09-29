import { Eraser, Lightbulb, Pencil, RotateCcw, X } from "lucide-react";
import { digitsFor } from "@/app/lib/board-logic";
import type { ShownHint } from "./types";
import { hintText } from "@/app/lib/hint-text";

type KeypadProps = {
  /** Side of the grid: the pad has one button per digit up to it. */
  size?: number;
  selectedValue: number;
  completed: ReadonlySet<number>;
  disabled: boolean;
  onDigit: (n: number) => void;
};

/** The digit buttons. */
export function Keypad({ size = 9, selectedValue, completed, disabled, onDigit }: KeypadProps) {
  return (
    <div
      className="keypad"
      aria-label="Clavier numérique"
      style={size === 9 ? undefined : { gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {digitsFor(size).map((n) => (
        <button
          key={n}
          aria-label={completed.has(n) ? `Chiffre ${n} complété` : `Placer le chiffre ${n}`}
          aria-pressed={selectedValue === n}
          disabled={disabled || completed.has(n)}
          className={`${selectedValue === n ? "active-number" : ""} ${completed.has(n) ? "completed-digit" : ""}`}
          onClick={() => onDigit(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

type GameActionsProps = {
  lost: boolean;
  competitive: boolean;
  noteMode: boolean;
  canUndo: boolean;
  hintsLeft: number;
  hintDisabled: boolean;
  /** Shown only when the player can start a new grid. */
  canAbandon: boolean;
  onToggleNotes: () => void;
  onErase: () => void;
  onUndo: () => void;
  onHint: () => void;
  onAbandon: () => void;
};

/** Notes, erase, undo, hint and abandon. */
export function GameActions(props: GameActionsProps) {
  const { lost, hintsLeft } = props;
  return (
    <div className="game-actions">
      <button
        aria-label="Activer ou désactiver les notes"
        aria-pressed={props.noteMode}
        disabled={props.competitive || lost}
        onClick={props.onToggleNotes}
        className={props.noteMode ? "notes-toggle active" : "notes-toggle"}
      >
        <Pencil />
        Notes <small>N</small>
      </button>
      <button aria-label="Effacer la case sélectionnée" disabled={lost} onClick={props.onErase}>
        <Eraser />
        Effacer
      </button>
      <button
        aria-label="Annuler la dernière action"
        onClick={props.onUndo}
        disabled={!props.canUndo || lost}
      >
        <RotateCcw />
        Annuler
      </button>
      <button
        aria-label={`Afficher un indice, ${Math.max(0, hintsLeft)} restant${hintsLeft === 1 ? "" : "s"}`}
        disabled={props.hintDisabled}
        onClick={props.onHint}
      >
        <Lightbulb />
        Indice ({Math.max(0, hintsLeft)})
      </button>
      {props.canAbandon && (
        <button
          className="abandon-grid"
          aria-label="Abandonner cette grille et en lancer une nouvelle"
          onClick={props.onAbandon}
        >
          <X aria-hidden="true" />
          Abandonner et relancer
        </button>
      )}
    </div>
  );
}

type HintPanelProps = { hint: ShownHint; onReveal: () => void; onDismiss: () => void };

/** Explains where to look, and gives the digit on request. */
export function HintPanel({ hint, onReveal, onDismiss }: HintPanelProps) {
  const text = hintText(hint.index, hint.step);
  return (
    <div className="hint-panel" role="status" aria-live="polite">
      <Lightbulb />
      <div>
        <b>{text.title}</b>
        <p>{text.text}</p>
        <div className="hint-actions">
          <button onClick={onReveal}>Révéler le chiffre</button>
          <button className="hint-dismiss" onClick={onDismiss}>
            J’ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
