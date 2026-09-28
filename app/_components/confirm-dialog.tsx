"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";

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
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  // Rendered at the page root, so no transformed parent can trap the fixed backdrop.
  return createPortal(
    <div className="account-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="account-dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
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
