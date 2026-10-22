"use client";

import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** `danger` for anything destructive. */
  variant?: ButtonVariant;
  /** The action is running: the confirm button waits. */
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** A yes/no question before something that is hard to undo. */
export function ConfirmModal({ open, title, body, confirmLabel, cancelLabel, variant = "danger", busy = false, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="neutral" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={variant} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
