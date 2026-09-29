import { Eraser, Lightbulb, Pencil, Redo2, RotateCcw, X } from "lucide-react";
import { digitsFor } from "@/app/lib/board-logic";
import type { ShownHint } from "./types";
import { hintText } from "@/app/lib/hint-text";
import { useI18n } from "@/app/lib/i18n";

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
  const { t } = useI18n();
  return (
    <div
      className="keypad"
      aria-label={t("keypad.label")}
      style={size === 9 ? undefined : { gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {digitsFor(size).map((n) => (
        <button
          key={n}
          aria-label={completed.has(n) ? t("keypad.done", { n }) : t("keypad.place", { n })}
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
  canRedo: boolean;
  hintsLeft: number;
  hintDisabled: boolean;
  /** Shown only when the player can start a new grid. */
  canAbandon: boolean;
  onToggleNotes: () => void;
  onErase: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onHint: () => void;
  onAbandon: () => void;
};

/** Notes, erase, undo, hint and abandon. */
export function GameActions(props: GameActionsProps) {
  const { lost, hintsLeft } = props;
  const { t } = useI18n();
  const left = Math.max(0, hintsLeft);
  return (
    <div className="game-actions">
      <button
        aria-label={t("actions.notesLabel")}
        aria-pressed={props.noteMode}
        disabled={props.competitive || lost}
        onClick={props.onToggleNotes}
        className={props.noteMode ? "notes-toggle active" : "notes-toggle"}
      >
        <Pencil />
        {t("actions.notes")} <small>N</small>
      </button>
      <button aria-label={t("actions.eraseLabel")} disabled={lost} onClick={props.onErase}>
        <Eraser />
        {t("actions.erase")}
      </button>
      <button
        aria-label={t("actions.undoLabel")}
        onClick={props.onUndo}
        disabled={!props.canUndo || lost}
      >
        <RotateCcw />
        {t("actions.undo")}
      </button>
      <button
        aria-label={t("actions.redoLabel")}
        onClick={props.onRedo}
        disabled={!props.canRedo || lost}
      >
        <Redo2 />
        {t("actions.redo")}
      </button>
      <button
        aria-label={t("actions.hintLabel", { count: left })}
        disabled={props.hintDisabled}
        onClick={props.onHint}
      >
        <Lightbulb />
        {t("actions.hint", { count: left })}
      </button>
      {props.canAbandon && (
        <button
          className="abandon-grid"
          aria-label={t("actions.abandonLabel")}
          onClick={props.onAbandon}
        >
          <X aria-hidden="true" />
          {t("actions.abandon")}
        </button>
      )}
    </div>
  );
}

type HintPanelProps = { hint: ShownHint; onReveal: () => void; onDismiss: () => void };

/** Explains where to look, and gives the digit on request. */
export function HintPanel({ hint, onReveal, onDismiss }: HintPanelProps) {
  const { t } = useI18n();
  const text = hintText(hint.index, hint.step, t);
  return (
    <div className="hint-panel" role="status" aria-live="polite">
      <Lightbulb />
      <div>
        <b>{text.title}</b>
        {text.techniques.length > 0 && (
          <ul className="hint-techniques" aria-label={t("hint.techniques")}>
            {text.techniques.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
        <p>{text.text}</p>
        {hint.step?.pattern && <small className="hint-legend">{t("hint.legend")}</small>}
        <div className="hint-actions">
          <button onClick={onReveal}>{t("hint.reveal")}</button>
          <button className="hint-dismiss" onClick={onDismiss}>
            {t("hint.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
