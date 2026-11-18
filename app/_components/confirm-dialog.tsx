"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert, X } from "lucide-react";

/** Asks the player to confirm an action they cannot undo. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // The parent may re-render every second (the game clock): keep the effect below from
  // re-running, which would steal the focus back each time.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });
  useEffect(() => {
    // The safe choice has the focus, so Enter never throws a game away by mistake.
    cancelRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
      // Keep digit and shortcut keys from reaching the board behind.
      e.stopImmediatePropagation();
    };
    // A click on the backdrop itself, outside the dialog, cancels too.
    const backdrop = backdropRef.current;
    const click = (e: MouseEvent) => {
      if (e.target === backdrop) onCancelRef.current();
    };
    window.addEventListener("keydown", key, true);
    backdrop?.addEventListener("click", click);
    return () => {
      window.removeEventListener("keydown", key, true);
      backdrop?.removeEventListener("click", click);
    };
  }, []);
  // Rendered at the page root, so no transformed parent can trap the fixed backdrop.
  return createPortal(
    <div ref={backdropRef} className="account-backdrop">
      <section
        className="account-dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <button
          type="button"
          className="account-close"
          aria-label="Fermer la confirmation"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </button>
        <div className="account-shield">
          <TriangleAlert />
        </div>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button ref={cancelRef} className="confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
