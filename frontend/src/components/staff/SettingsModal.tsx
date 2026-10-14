"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { Modal } from "@/components/ui/Modal";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  name: string;
};

/** Account settings: who is signed in, the language switcher and sign out. */
export function SettingsModal({ open, onClose, name }: SettingsModalProps) {
  const t = useTranslations("staff.menu");
  const tc = useTranslations("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("title")}
      actions={
        <>
          <Button variant="neutral" onClick={onClose}>
            {t("close")}
          </Button>
          <ButtonLink href="/login" variant="danger">
            {t("signOut")}
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-body font-bold">{name}</p>
        <p className="text-body font-bold text-ink-muted">{tc("language")}</p>
        <LocaleSwitcher />
      </div>
    </Modal>
  );
}
