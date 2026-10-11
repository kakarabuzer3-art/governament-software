"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Action buttons rendered at the bottom right. */
  actions?: ReactNode;
  /** Accessible label for the close button. */
  closeLabel?: string;
}

/**
 * Accessible glass modal dialog.
 * - Enter: smooth fade/scale transition (see .modal-backdrop styles).
 * - Escape and backdrop click close it.
 * - Focus moves into the dialog on open and returns on close.
 * - The dialog stays mounted but visibility:hidden when closed, so
 *   hidden controls are unreachable by keyboard.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  closeLabel = "Close dialog",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      className={`modal-backdrop${open ? " is-open" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal glass glass--strong"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="panel-header">
          <h2 className="modal-title" id="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <span aria-hidden="true">&#10005;</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
