"use client";

import { useTranslations } from "next-intl";
import { Copy } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

type PasswordModalProps = {
  open: boolean;
  /** Who the password is for. */
  name: string;
  /** Shown once. The screen forgets it when this modal closes. */
  password: string;
  onCopy: () => void;
  onClose: () => void;
};

export function PasswordModal({ open, name, password, onCopy, onClose }: PasswordModalProps) {
  const t = useTranslations("admin.password");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      actions={
        <>
          <Button variant="secondary" onClick={onCopy}>
            <Icon icon={Copy} weight="bold" />
            {t("copy")}
          </Button>
          <Button onClick={onClose}>{t("done")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>{t("body", { name })}</p>
        <p className="select-all rounded-md bg-field px-4 py-3 text-center text-h2 font-black tabular-nums text-on-field [overflow-wrap:anywhere]">
          {password}
        </p>
        <p className="text-body font-bold text-ink-muted">{t("once")}</p>
      </div>
    </Modal>
  );
}
