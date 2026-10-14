"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Translated dialog title. */
  title: string;
  children?: ReactNode;
  /** Buttons for the bottom row, e.g. a neutral cancel and a danger confirm. */
  actions?: ReactNode;
  className?: string;
};

/** Native <dialog>: focus trap, Esc to close and inert background come from the browser. */
export function Modal({ open, onClose, title, children, actions, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        "m-auto w-[calc(100%-var(--space-8))] max-w-[480px] rounded-lg border-2 border-border bg-surface-raised p-6 text-ink",
        "shadow-[0_4px_0_0_var(--border)] backdrop:bg-ink/60",
        className,
      )}
    >
      <h2 id={titleId} className="text-h3 font-bold">
        {title}
      </h2>
      {children ? <div className="mt-2 text-body-lg">{children}</div> : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-end gap-4">{actions}</div> : null}
    </dialog>
  );
}
